const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("v");
  if (!videoId) {
    return new Response(JSON.stringify({ error: "Missing v" }), { status: 400, headers: CORS });
  }

  try {
    const html = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Cookie": "CONSENT=YES+cb; YSC=DwKYllHNwuw; VISITOR_INFO1_LIVE=oGKts0pIiuQ",
      },
    }).then((r) => r.text());

    const match = html.match(/"captionTracks":\s*(\[.*?\])/);
    if (!match) {
      return new Response(JSON.stringify({ error: "no_transcript" }), { headers: CORS });
    }

    const tracks = JSON.parse(match[1]);
    if (!tracks.length) {
      return new Response(JSON.stringify({ error: "no_transcript" }), { headers: CORS });
    }

    const captionUrl = tracks[0].baseUrl + "&fmt=json3";
    const captionData = await fetch(captionUrl).then((r) => r.json());

    const text = (captionData.events || [])
      .filter((e) => e.segs)
      .map((e) => e.segs.map((s) => s.utf8 || "").join(""))
      .join(" ");

    if (!text || text.length < 20) {
      return new Response(JSON.stringify({ error: "no_transcript" }), { headers: CORS });
    }

    return new Response(
      JSON.stringify({ transcript: text, lang: tracks[0].languageCode }),
      { headers: CORS }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message, stack: err.stack?.slice(0, 200) }),
      { status: 500, headers: CORS }
    );
  }
};

export const config = { path: "/api/transcript" };
