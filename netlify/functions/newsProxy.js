/**
 * Netlify Function: newsProxy
 * Purpose: Server-side fetch of Nasdaq-related headlines (no CORS issues)
 */

export async function handler() {
  try {
    const response = await fetch(
      "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EIXIC&region=US&lang=en-US",
      {
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch Nasdaq headlines");
    }

    const text = await response.text();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=300"
      },
      body: text
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}
