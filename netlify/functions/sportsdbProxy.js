/**
 * Netlify Function: sportsdbProxy
 * Proxies TheSportsDB requests server-side (helps with CORS and rate limiting).
 * Usage: /.netlify/functions/sportsdbProxy?endpoint=eventsnextleague&id=4516
 *
 * NOTE: This uses the free public key "1" (TheSportsDB demo key).
 */
const ALLOWED_ENDPOINTS = new Set([
  "eventsnextleague",
  "eventsround",
  "eventspastleague",
  "lookupleague",
]);

export default async (req) => {
  try {
    const url = new URL(req.url);
    const endpoint = (url.searchParams.get("endpoint") || "").trim();
    const id = (url.searchParams.get("id") || "").trim();

    if (!ALLOWED_ENDPOINTS.has(endpoint) || !id) {
      return new Response(JSON.stringify({ error: "Bad request", endpoint, id }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const upstream = `https://www.thesportsdb.com/api/v1/json/1/${endpoint}.php?id=${encodeURIComponent(id)}`;
    const r = await fetch(upstream, {
      headers: { "Accept": "application/json", "User-Agent": "NetlifyFunction/sportsdbProxy" },
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return new Response(JSON.stringify({ error: "Upstream error", status: r.status, body: txt.slice(0, 500) }), {
        status: 502,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    }

    const data = await r.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=300",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
};
