/**
 * Cloudflare Worker Entry Point for portal.referendum21.org
 * 
 * Intercepts /api/* requests (e.g. /api/count, /api/send-push) and forwards
 * all other static assets and SPA routes to env.ASSETS.
 */

// @ts-ignore
import { onRequestGet as handleCountGet, onRequestOptions as handleCountOptions } from '../functions/api/count.js';
// @ts-ignore
import { onRequestPost as handlePushPost, onRequestOptions as handlePushOptions } from '../functions/api/send-push.js';

export interface Env {
  ASSETS: {
    fetch: (req: Request | string) => Promise<Response>;
  };
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  DEFAULT_GOAL?: string;
}

export interface WorkerContext {
  waitUntil: (promise: Promise<unknown>) => void;
}

export default {
  async fetch(request: Request, env: Env, ctx: WorkerContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. /api/count endpoint for landing page and real-time tallies
    if (url.pathname === '/api/count') {
      if (request.method === 'OPTIONS') {
        return handleCountOptions({ request, env, waitUntil: (p: Promise<unknown>) => ctx.waitUntil(p) });
      }
      if (request.method === 'GET') {
        return handleCountGet({ request, env, waitUntil: (p: Promise<unknown>) => ctx.waitUntil(p) });
      }
      return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. /api/send-push endpoint for broadcast notifications
    if (url.pathname === '/api/send-push') {
      if (request.method === 'OPTIONS') {
        return handlePushOptions({ request, env, waitUntil: (p: Promise<unknown>) => ctx.waitUntil(p) });
      }
      if (request.method === 'POST') {
        return handlePushPost({ request, env, waitUntil: (p: Promise<unknown>) => ctx.waitUntil(p) });
      }
      return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Delegate all static assets and SPA routes to Cloudflare Assets
    return env.ASSETS.fetch(request);
  },
};
