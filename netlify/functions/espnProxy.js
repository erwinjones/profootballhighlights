/**
 * Netlify Function: espnProxy
 * Proxies ESPN scoreboard endpoints server-side to avoid browser CORS blocks.
 * Usage: /.netlify/functions/espnProxy?path=basketball/nba/scoreboard
 */
const ALLOWED_PATHS = new Set([
  // Pro Football Highlights
  "football/nfl/scoreboard",
  "football/nfl/standings",

  // Hardwood Highlights
  "basketball/nba/scoreboard",
  "basketball/wnba/scoreboard",
  "basketball/mens-college-basketball/scoreboard",
  "basketball/womens-college-basketball/scoreboard",
]);

export default async (req) => {
  try {
    const url = new URL(req.url);
    const path = (url.searchParams.get("path") || "").replace(/^\//, "");
    if (!ALLOWED_PATHS.has(path)) {
      return new Response(JSON.stringify({ error: "Path not allowed", path }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const upstream = `https://site.api.espn.com/apis/site/v2/sports/${path}`;
    const r = await fetch(upstream, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "NetlifyFunction/espnProxy",
      },
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return new Response(JSON.stringify({ error: "Upstream error", status: r.status, body: txt.slice(0, 500) }), {
        status: 502,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    }

    const data = await r.json();

    // Cache a bit so you don't hit rate limits. Adjust as needed.
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=20", // ~near-live
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
};
