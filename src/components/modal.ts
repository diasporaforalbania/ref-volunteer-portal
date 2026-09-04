import { esc } from '../utils/security';

export function closeModal(): void {
  const modal = document.getElementById('modal');
  if (modal) modal.remove();
}

export function openModal(contentHtml: string): void {
  closeModal();
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div class="modal-bg" id="modal">${contentHtml}</div>`
  );
}

export function confirmAction(options: {
  title: string;
  message: string;
  confirmText?: string;
  confirmClass?: string;
  icon?: string;
}): Promise<boolean> {
  return new Promise(resolve => {
    const icon = options.icon || '⚠️';
    const confirmText = options.confirmText || 'Po, vazhdo';
    const confirmClass = options.confirmClass || 'btn red sm';

    openModal(`
      <div class="modal" style="max-width:440px">
        <div class="row" style="gap:14px;align-items:flex-start;margin-bottom:12px">
          <span style="font-size:26px;line-height:1;margin-top:2px" aria-hidden="true">${icon}</span>
          <div style="flex:1;min-width:0">
            <h3 style="margin:0;font-size:18px">${esc(options.title)}</h3>
            <p style="margin:6px 0 0;font-size:13.5px;color:var(--muted);line-height:1.4">${esc(options.message)}</p>
          </div>
        </div>
        <div class="row" style="justify-content:flex-end;gap:8px;margin-top:18px">
          <button class="btn ghost sm" id="confirm_cancel_btn" type="button">Anulo</button>
          <button class="${confirmClass}" id="confirm_ok_btn" type="button">${esc(confirmText)}</button>
        </div>
      </div>`);

    document.getElementById('confirm_cancel_btn')?.addEventListener('click', () => {
      closeModal();
      resolve(false);
    });
    document.getElementById('confirm_ok_btn')?.addEventListener('click', () => {
      closeModal();
      resolve(true);
    });
  });
}

// Close on backdrop click
document.addEventListener('click', (e: MouseEvent) => {
  const target = e.target as HTMLElement | null;
  if (target && target.id === 'modal') {
    closeModal();
  }
});

// Close on Escape key
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    closeModal();
  }
});
