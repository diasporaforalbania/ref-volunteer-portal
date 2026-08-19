/**
 * Cloudflare Worker Entry Point for portal.referendum21.org
 * 
 * Intercepts /api/* requests (e.g. /api/count, /api/points, /api/send-push) and forwards
 * all other static assets and SPA routes to env.ASSETS.
 */

// @ts-ignore
import { onRequestGet as handleCountGet, onRequestOptions as handleCountOptions } from '../functions/api/count.js';
// @ts-ignore
import { onRequestPost as handlePushPost, onRequestOptions as handlePushOptions } from '../functions/api/send-push.js';
// @ts-ignore
import { onRequestGet as handlePointsGet, onRequestOptions as handlePointsOptions } from '../functions/api/points.js';

export interface Env {
  ASSETS: {
    fetch: (req: Request | string) => Promise<Response>;
  };
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  DEFAULT_GOAL?: string;
  VAPID_PUBLIC_KEY?: string;
}

export interface WorkerContext {
  waitUntil: (promise: Promise<unknown>) => void;
}

/**
 * `HTMLRewriter` deklarohet me dorë, aq sa përdoret më poshtë, njësoj si `Env`
 * dhe `WorkerContext`. `@cloudflare/workers-types` do t'i mbulonte të tria, por
 * `tsconfig.json` e përfshin gjithë `src/` me `lib: ["DOM", ...]` — pjesa tjetër
 * e kësaj dosjeje është SPA në shfletues — dhe tipat e Workers-it përplasen me
 * DOM-in mbi të njëjtat emra globalë.
 */
interface RewriterElement {
  append(content: string, options?: { html?: boolean }): void;
}

interface HtmlRewriter {
  on(selector: string, handlers: { element(element: RewriterElement): void }): HtmlRewriter;
  transform(response: Response): Response;
}

declare const HTMLRewriter: { new (): HtmlRewriter };

/**
 * Çelësat VAPID janë base64url — vetëm shkronja, shifra, `-` dhe `_`. Çdo gjë
 * tjetër nuk shkruhet fare te faqja, që një variabël e ngatërruar te Cloudflare
 * të mos përfundojë si atribut i shformuar në HTML.
 */
const VAPID_KEY_SHAPE = /^[A-Za-z0-9_-]+$/;

/**
 * Ia kalon shfletuesit çelësin publik VAPID si `<meta>` te `<head>`.
 *
 * Pse kështu, dhe jo si variabël ndërtimi: `VITE_VAPID_PUBLIC_KEY` piqet brenda
 * paketës kur ndërtohet. Mjafton të mos jetë vendosur te Cloudflare → Settings →
 * build variables që paketa e publikuar të dalë me çelës bosh, dhe atëherë çdo
 * vullnetar lexon «Njoftimet nuk janë aktivizuar ende nga qendra» edhe pse
 * serveri i ka çelësat. Këtu lexohet i njëjti `env.VAPID_PUBLIC_KEY` që përdor
 * `functions/api/send-push.js` për të nënshkruar, ndaj shfletuesi dhe dërguesi
 * s'kanë si të mbeten me çelësa të ndryshëm, dhe ndërrimi i çelësit nuk kërkon
 * rindërtim — mjafton ripublikimi.
 *
 * `<meta>` dhe jo `<script>`: CSP-ja te `_headers` është `script-src 'self'`,
 * pa `'unsafe-inline'`, ndaj një skript i brendshëm do të bllokohej.
 */
async function withRuntimeConfig(request: Request, env: Env): Promise<Response> {
  const key = (env.VAPID_PUBLIC_KEY || '').trim();
  const wantsHtml = (request.headers.get('Accept') || '').includes('text/html');
  if (!key || !VAPID_KEY_SHAPE.test(key) || !wantsHtml) return env.ASSETS.fetch(request);

  // Kërkesa me kusht duhet zhveshur PARA se t'i kalojë assets-eve. Ndryshe
  // shfletuesi dërgon `If-None-Match`, shtresa e assets-eve përgjigjet `304` pa
  // trup, HTMLRewriter nuk ka çfarë të shkruajë, dhe shfletuesi rikthen kopjen e
  // vet të vjetër — pikërisht atë pa `<meta>`. Guaska është ~1KB dhe tashmë
  // `no-cache` te `_headers`, ndaj s'humbet gjë.
  const unconditional = new Request(request);
  unconditional.headers.delete('If-None-Match');
  unconditional.headers.delete('If-Modified-Since');

  const res = await env.ASSETS.fetch(unconditional);
  if (!(res.headers.get('Content-Type') || '').includes('text/html')) return res;

  const rewritten = new HTMLRewriter()
    .on('head', {
      element(el) {
        el.append(`<meta name="vapid-public-key" content="${key}">`, { html: true });
      },
    })
    .transform(res);

  // Trupi nuk është më ai i skedarit në disk, ndaj etiketat e freskisë së tij
  // nuk e përshkruajnë më atë që po kthejmë.
  const out = new Response(rewritten.body, rewritten);
  out.headers.delete('ETag');
  out.headers.delete('Last-Modified');
  return out;
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

    // 2. /api/points endpoint for the public "where to sign" cards
    //
    // KUJDES: një endpoint i ri NUK shfaqet vetvetiu sepse skedari ekziston te
    // `functions/api/`. Kjo dosje nuk rutohet nga Cloudflare — `wrangler.toml`
    // ka `main = "src/worker.ts"`, ndaj ky skedar është i vetmi ruter. Pa
    // rreshtat e mëposhtëm kërkesa bie te `env.ASSETS.fetch()` dhe prodhimi
    // kthen `error code: 1101`.
    if (url.pathname === '/api/points') {
      if (request.method === 'OPTIONS') {
        return handlePointsOptions({ request, env, waitUntil: (p: Promise<unknown>) => ctx.waitUntil(p) });
      }
      if (request.method === 'GET') {
        return handlePointsGet({ request, env, waitUntil: (p: Promise<unknown>) => ctx.waitUntil(p) });
      }
      return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. /api/send-push endpoint for broadcast notifications
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

    // 4. Delegate all static assets and SPA routes to Cloudflare Assets
    return withRuntimeConfig(request, env);
  },
};
