/**
 * Netlify Function: wikiStandings
 *
 * Fetches NFL standings tables from Wikipedia (MediaWiki Action API) and returns rendered HTML
 * for the client to parse into AFC/NFC division tables.
 */

const API_BASE = "https://en.wikipedia.org/w/api.php";

async function fetchTemplateHTML(title, timeoutMs = 9000) {
  const url = `${API_BASE}?action=parse&format=json&prop=text&section=0&origin=*&page=${encodeURIComponent(title)}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "profootballhighlights/1.0 (+https://profootballhighlights.netlify.app)"
      }
    });
    if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);
    const data = await res.json();
    const html = data?.parse?.text?.["*"];
    if (!html || html.length < 200) throw new Error("Wikipedia parse returned no html");
    return html;
  } finally {
    clearTimeout(t);
  }
}

exports.handler = async function () {
  try {
    const year = new Date().getFullYear();

    const candidatePairs = [
      [`Template:${year} AFC standings`, `Template:${year} NFC standings`],
      [`Template:${year - 1} AFC standings`, `Template:${year - 1} NFC standings`],
    ];

    let lastErr = null;

    for (const [afcTitle, nfcTitle] of candidatePairs) {
      try {
        const [afcHtml, nfcHtml] = await Promise.all([
          fetchTemplateHTML(afcTitle),
          fetchTemplateHTML(nfcTitle),
        ]);

        return {
          statusCode: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          },
          body: JSON.stringify({
            source: "Wikipedia",
            titles: [afcTitle, nfcTitle],
            html: `${afcHtml}\n\n${nfcHtml}`,
          }),
        };
      } catch (err) {
        lastErr = err;
        continue;
      }
    }

    throw lastErr || new Error("No Wikipedia candidates returned standings");
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
      body: JSON.stringify({ error: String((err && err.message) || err) }),
    };
  }
};
