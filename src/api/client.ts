import { createClient, type SupabaseClient } from '@supabase/supabase-js';

declare global {
  interface Window {
    supabase?: {
      createClient: (url: string, key: string, options?: any) => SupabaseClient;
    };
    QRCode?: any;
    sb?: SupabaseClient;
  }
}

export const SUPABASE_URL: string =
  (import.meta.env.VITE_SUPABASE_URL || (typeof window !== 'undefined' && (window as any).SUPABASE_URL) || '').trim();

export const SUPABASE_ANON_KEY: string =
  (import.meta.env.VITE_SUPABASE_ANON_KEY || (typeof window !== 'undefined' && (window as any).SUPABASE_ANON_KEY) || '').trim();

export const DEFAULT_GOAL: number =
  Number(import.meta.env.VITE_DEFAULT_GOAL) || 50000;

/**
 * Çelësi publik VAPID — lexohet në kohë ekzekutimi, jo vetëm në ndërtim.
 *
 * Renditja ka rëndësi. Meta-etiketa vjen e para sepse Worker-i e mbush nga i
 * njëjti `VAPID_PUBLIC_KEY` me të cilin nënshkruan dërguesi te
 * `functions/api/send-push.js`: kështu shfletuesi dhe serveri s'kanë si të
 * mbeten me çelësa të ndryshëm. `VITE_VAPID_PUBLIC_KEY` mbetet vetëm për
 * `npm run dev`, ku faqja shërbehet nga Vite dhe Worker-i nuk ndërhyn.
 *
 * Më parë kjo varej VETËM nga `VITE_VAPID_PUBLIC_KEY`. Ajo është variabël
 * ndërtimi: po mungoi te Cloudflare kur ndërtohet paketa, çelësi del bosh dhe
 * çdo vullnetar lexon «Njoftimet nuk janë aktivizuar ende nga qendra», edhe pse
 * serveri i ka çelësat në rregull.
 */
function readVapidPublicKey(): string {
  if (typeof document !== 'undefined') {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="vapid-public-key"]');
    const fromRuntime = (meta?.content || '').trim();
    if (fromRuntime) return fromRuntime;
  }
  const fromBuild = (import.meta.env.VITE_VAPID_PUBLIC_KEY || '').trim();
  if (fromBuild) return fromBuild;
  return (
    (typeof window !== 'undefined' && (window as any).VAPID_PUBLIC_KEY) || ''
  ).trim();
}

export const VAPID_PUBLIC_KEY: string = readVapidPublicKey();

export function isConfigMissing(): boolean {
  return (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY ||
    SUPABASE_URL.startsWith('PASTE_') ||
    SUPABASE_ANON_KEY.startsWith('PASTE_')
  );
}

function initSupabase(): SupabaseClient {
  if (typeof window !== 'undefined' && window.supabase?.createClient) {
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  if (!isConfigMissing()) {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return createClient('https://placeholder.supabase.co', 'placeholder');
}

export const sb: SupabaseClient = initSupabase();
