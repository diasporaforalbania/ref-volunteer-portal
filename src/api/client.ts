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

export const VAPID_PUBLIC_KEY: string =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY || (typeof window !== 'undefined' && (window as any).VAPID_PUBLIC_KEY) || '').trim();

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
