import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || 'https://yymmdyjjjvjbyleaoygf.supabase.co';
  const supabaseAnonKey =
    env.VITE_SUPABASE_ANON_KEY ||
    env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5bW1keWpqanZqYnlsZWFveWdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3ODUzODEsImV4cCI6MjA5ODM2MTM4MX0.mxR0_mF37Ste8eFgKKEBNwFXAILVY8JdZMQo-1zbkE0';

  return {
    // Absolute, not './': with `not_found_handling = single-page-application`
    // the shell can be served at any path, and relative asset URLs would then
    // resolve to /<that-path>/assets/... and 404 into a blank page.
    base: '/',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: true,
      emptyOutDir: true,
    },
    server: {
      port: 3000,
      open: false,
    },
    plugins: [
      {
        name: 'dev-api-count',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const url = req.url ? new URL(req.url, `http://${req.headers.host || 'localhost'}`) : null;
            if (url && url.pathname === '/api/count') {
              const origin = req.headers.origin || '*';
              res.setHeader('Access-Control-Allow-Origin', origin);
              res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey, authorization');
              res.setHeader('Access-Control-Max-Age', '86400');
              res.setHeader('Vary', 'Origin');

              if (req.method === 'OPTIONS') {
                res.statusCode = 204;
                res.end();
                return;
              }

              if (req.method === 'GET') {
                try {
                  const upstream = await fetch(
                    `${supabaseUrl}/rest/v1/signature_totals?select=signatures,goal,updated`,
                    {
                      headers: {
                        apikey: supabaseAnonKey,
                        Authorization: `Bearer ${supabaseAnonKey}`,
                        Accept: 'application/json',
                      },
                    }
                  );

                  if (!upstream.ok) {
                    res.statusCode = 502;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'upstream_unavailable' }));
                    return;
                  }

                  const rows = await upstream.json();
                  const row = Array.isArray(rows) ? rows[0] : rows;
                  const rawSignatures = Number(row?.signatures);
                  const signatures =
                    Number.isFinite(rawSignatures) && rawSignatures >= 0 ? Math.floor(rawSignatures) : 0;
                  const rawGoal = Number(row?.goal);
                  const goal = Number.isFinite(rawGoal) && rawGoal > 0 ? Math.floor(rawGoal) : 50000;

                  const payload = {
                    signatures,
                    goal,
                    updated: row?.updated || new Date().toISOString(),
                    generated_at: new Date().toISOString(),
                  };

                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.setHeader('Cache-Control', 'no-cache');
                  res.end(JSON.stringify(payload));
                  return;
                } catch (err: unknown) {
                  const message = err instanceof Error ? err.message : 'Unknown error';
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'internal_error', message }));
                  return;
                }
              }
            }
            next();
          });
        },
      },
      {
        // Pikat aktive te nenshkrimit -- pasqyron functions/api/points.js, qe
        // `npm run dev` te sillet si Cloudflare Pages. Logjika e sigurise e
        // vertete jeton te endpointi; ky middleware ekziston vetem per zhvillim.
        name: 'dev-api-points',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const url = req.url ? new URL(req.url, `http://${req.headers.host || 'localhost'}`) : null;
            if (!url || url.pathname !== '/api/points') return next();

            const origin = req.headers.origin || '*';
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.setHeader('Access-Control-Max-Age', '86400');
            res.setHeader('Vary', 'Origin');

            if (req.method === 'OPTIONS') {
              res.statusCode = 204;
              res.end();
              return;
            }
            if (req.method !== 'GET') return next();

            try {
              const { sanitizePoints } = await server.ssrLoadModule('/functions/api/points.js');
              const select = 'id,unit_code,unit_name,point_name,city,lat,lng,opens_at,closes_at';
              const upstream = await fetch(
                `${supabaseUrl}/rest/v1/public_signing_points?select=${encodeURIComponent(select)}&limit=200`,
                {
                  headers: {
                    apikey: supabaseAnonKey,
                    Authorization: `Bearer ${supabaseAnonKey}`,
                    Accept: 'application/json',
                  },
                }
              );

              if (!upstream.ok) {
                res.statusCode = 502;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'upstream_unavailable' }));
                return;
              }

              const points = sanitizePoints(await upstream.json());
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.setHeader('Cache-Control', 'no-cache');
              res.end(JSON.stringify({
                points,
                count: points.length,
                generated_at: new Date().toISOString(),
              }));
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : 'Unknown error';
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'internal_error', message }));
            }
          });
        },
      },
    ],
  };
});
