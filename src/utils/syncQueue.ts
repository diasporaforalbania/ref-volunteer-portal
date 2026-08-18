import { sb } from '../api/client';

export interface QueuedAction {
  id: string;
  type: 'SHIFT_CHECK_IN' | 'SHIFT_CHECK_OUT' | 'CHECKIN_CLOSE_OWN';
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastAttemptAt?: number;
}

const DB_NAME = 'ref_field_db';
const DB_VERSION = 1;
const STORE_NAME = 'sync_queue';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported in this environment.'));
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueAction(
  action: Omit<QueuedAction, 'id' | 'createdAt' | 'attempts'>
): Promise<string> {
  try {
    const db = await openDB();
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    const item: QueuedAction = { ...action, id, createdAt: Date.now(), attempts: 0 };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(item);
      tx.oncomplete = () => {
        resolve(id);
        triggerFlush();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to enqueue to IndexedDB:', err);
    return '';
  }
}

export async function getPendingActions(): Promise<QueuedAction[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result.sort((a, b) => a.createdAt - b.createdAt));
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function removeAction(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed to remove action from IndexedDB:', err);
  }
}

let isFlushing = false;

export async function triggerFlush(): Promise<void> {
  if (isFlushing || typeof navigator === 'undefined' || !navigator.onLine) return;
  isFlushing = true;

  try {
    const queue = await getPendingActions();
    for (const item of queue) {
      const backoffMs = Math.min(60000, Math.pow(2, item.attempts) * 1000 + Math.random() * 500);
      if (item.lastAttemptAt && Date.now() - item.lastAttemptAt < backoffMs) continue;

      item.attempts++;
      item.lastAttemptAt = Date.now();

      let res: { error: any };
      if (item.type === 'SHIFT_CHECK_IN') {
        res = await sb.rpc('shift_check_in', item.payload);
      } else if (item.type === 'SHIFT_CHECK_OUT') {
        res = await sb.rpc('shift_check_out', item.payload);
      } else if (item.type === 'CHECKIN_CLOSE_OWN') {
        res = await sb.rpc('checkin_close_own', item.payload);
      } else {
        await removeAction(item.id);
        continue;
      }

      if (!res.error) {
        await removeAction(item.id);
      } else {
        if (res.error.code === 'PGRST301' || res.error.message?.includes('JWT')) break;
      }
    }
  } finally {
    isFlushing = false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', triggerFlush);
}
