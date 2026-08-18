// Drag & drop for the unit board. Built on pointer events rather than the
// HTML5 drag API: the portal is a PWA and phones ignore HTML5 drag entirely.
// Every drag is also reachable without one — tap a marble, tap a slot; or with
// the keyboard, Enter on a marble then Enter on a slot.

export interface DndConfig {
  /** Stable container. Listeners are delegated here, so re-rendering its inner HTML is safe. */
  root: HTMLElement;
  /** Selector for draggable items. */
  itemSel: string;
  /** Selector for drop targets. */
  zoneSel: string;
  /** May this item land in this zone? Called on every hover, so keep it cheap. */
  accepts: (zone: HTMLElement, item: HTMLElement) => boolean;
  /** Item landed on an accepting zone. */
  onDrop: (zone: HTMLElement, item: HTMLElement) => void;
  /** Item was dropped or tapped somewhere it may not go. */
  onReject?: (zone: HTMLElement | null, item: HTMLElement) => void;
  /** Dragged and let go over nothing that accepts it. */
  onMiss?: (item: HTMLElement) => void;
  /** Picked an item up (item) or put it down (null) — for status text. */
  onPick?: (item: HTMLElement | null) => void;
}

const DRAG_SLOP = 5; // px of movement before a press becomes a drag
const CLICK_GUARD = 350; // ms after a drag in which clicks are ignored

export function attachDnd(cfg: DndConfig): () => void {
  const { root } = cfg;

  let picked: HTMLElement | null = null; // armed by tap/keyboard
  let drag: {
    item: HTMLElement;
    x0: number;
    y0: number;
    ghost: HTMLElement | null;
    gx: number;
    gy: number;
    hot: HTMLElement | null;
  } | null = null;
  let moved = false;
  let lastDrag = 0;

  const zones = (): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>(cfg.zoneSel));

  function markEligible(item: HTMLElement | null): void {
    zones().forEach(z => {
      z.classList.toggle('eligible', !!item && cfg.accepts(z, item));
      if (!item) z.classList.remove('hot');
    });
  }

  function markPicked(): void {
    root.querySelectorAll<HTMLElement>(cfg.itemSel).forEach(el => {
      el.classList.toggle('picked', el === picked);
    });
  }

  function drop(): void {
    picked = null;
    markPicked();
    markEligible(null);
  }

  function pick(item: HTMLElement): void {
    if (picked === item) {
      drop();
      cfg.onPick?.(null);
      return;
    }
    picked = item;
    markPicked();
    markEligible(item);
    cfg.onPick?.(item);
  }

  function refuse(zone: HTMLElement | null, item: HTMLElement): void {
    cfg.onReject?.(zone, item);
    item.classList.add('deny');
    setTimeout(() => item.classList.remove('deny'), 320);
  }

  // ---- press & drag --------------------------------------------------------
  function onPointerDown(e: PointerEvent): void {
    if (e.button > 0) return;
    const item = (e.target as HTMLElement | null)?.closest<HTMLElement>(cfg.itemSel);
    if (!item || !root.contains(item)) return;
    moved = false;
    drag = { item, x0: e.clientX, y0: e.clientY, ghost: null, gx: 0, gy: 0, hot: null };
  }

  function onPointerMove(e: PointerEvent): void {
    if (!drag) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;

    if (!drag.ghost) {
      if (dx * dx + dy * dy < DRAG_SLOP * DRAG_SLOP) return;
      moved = true;
      if (picked) drop();

      const r = drag.item.getBoundingClientRect();
      const ghost = drag.item.cloneNode(true) as HTMLElement;
      ghost.classList.remove('picked');
      ghost.classList.add('ghost');
      ghost.style.width = `${r.width}px`;
      document.body.appendChild(ghost);

      drag.ghost = ghost;
      drag.gx = e.clientX - r.left;
      drag.gy = e.clientY - r.top;
      drag.item.classList.add('lifting');
      markEligible(drag.item);
    }

    drag.ghost.style.transform =
      `translate(${e.clientX - drag.gx}px, ${e.clientY - drag.gy}px) rotate(-1.5deg)`;

    const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    let zone = under?.closest<HTMLElement>(cfg.zoneSel) || null;
    if (zone && (!root.contains(zone) || !cfg.accepts(zone, drag.item))) zone = null;
    if (zone !== drag.hot) {
      drag.hot?.classList.remove('hot');
      zone?.classList.add('hot');
      drag.hot = zone;
    }
  }

  function onPointerUp(): void {
    if (!drag) return;
    const d = drag;
    drag = null;

    if (d.ghost) {
      d.ghost.remove();
      d.item.classList.remove('lifting');
      markEligible(null);
      if (d.hot) {
        d.hot.classList.remove('hot');
        cfg.onDrop(d.hot, d.item);
      } else {
        cfg.onMiss?.(d.item);
      }
    }
    // A press that turned into a drag also fires a click; ignore that one so
    // dropping a marble does not immediately pick it back up.
    if (moved) lastDrag = performance.now();
    moved = false;
  }

  // ---- tap to place --------------------------------------------------------
  function onClick(e: MouseEvent): void {
    if (performance.now() - lastDrag < CLICK_GUARD) return;
    const target = e.target as HTMLElement | null;

    const item = target?.closest<HTMLElement>(cfg.itemSel);
    if (item && root.contains(item)) {
      pick(item);
      return;
    }

    const zone = target?.closest<HTMLElement>(cfg.zoneSel);
    if (zone && root.contains(zone) && picked) {
      const held = picked;
      if (!cfg.accepts(zone, held)) return refuse(zone, held);
      drop();
      cfg.onDrop(zone, held);
      return;
    }

    if (picked) {
      drop();
      cfg.onPick?.(null);
    }
  }

  // A click anywhere off the board puts the held marble down too — otherwise
  // it stays armed and the next tap lands it somewhere unintended.
  function onDocClick(e: MouseEvent): void {
    if (!picked) return;
    const target = e.target as HTMLElement | null;
    if (target && root.contains(target)) return; // onClick already handled it
    drop();
    cfg.onPick?.(null);
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && picked) {
      drop();
      cfg.onPick?.(null);
      return;
    }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = e.target as HTMLElement | null;
    if (!picked || target?.closest(cfg.itemSel)) return;

    const zone = target?.closest<HTMLElement>(cfg.zoneSel);
    if (!zone || !root.contains(zone)) return;
    e.preventDefault();

    const held = picked;
    if (!cfg.accepts(zone, held)) return refuse(zone, held);
    drop();
    cfg.onDrop(zone, held);
  }

  root.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerUp);
  root.addEventListener('click', onClick);
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onKeyDown);

  return () => {
    root.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);
    root.removeEventListener('click', onClick);
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onKeyDown);
    document.querySelectorAll('.ghost').forEach(g => g.remove());
  };
}
