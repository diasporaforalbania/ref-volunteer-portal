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
