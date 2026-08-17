import { sb } from './client';

export function subscribeToFieldUpdates(onUpdate: () => void): () => void {
  if (!sb?.channel) return () => {};

  const channel = sb
    .channel('public:field_realtime')
    .on(
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: 'checkins' },
      () => {
        onUpdate();
      }
    )
    .on(
      'postgres_changes' as any,
      { event: 'INSERT', schema: 'public', table: 'announcements' },
      (payload: { new: any }) => {
        window.dispatchEvent(
          new CustomEvent('app:new_announcement', { detail: payload.new })
        );
      }
    )
    .subscribe();

  return () => {
    sb.removeChannel(channel);
  };
}
