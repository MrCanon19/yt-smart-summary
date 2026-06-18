import { getStore } from "@netlify/blobs";
import Groq from "groq-sdk";
import { YoutubeTranscript } from "youtube-transcript";

const YT_API_KEY = process.env.YOUTUBE_API_KEY;

export const config = {
  type: "background",
};


async function fetchTranscriptTimedtext(videoId) {
  // Step 1: get list of available caption tracks (no watch page scraping needed)
  const listRes = await fetch(
    `https://www.youtube.com/api/timedtext?v=${videoId}&type=list`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!listRes.ok) return null;
  const listXml = await listRes.text();
  if (!listXml.includes("lang_code")) return null;

  // Pick first available language (prefer auto-generated 'a.' prefix tracks)
  const autoMatch = listXml.match(/lang_code="(a\.[^"]+)"/);
  const anyMatch = listXml.match(/lang_code="([^"]+)"/);
  const lang = (autoMatch || anyMatch)?.[1];
  if (!lang) return null;

  // Step 2: fetch the actual transcript
  const captionRes = await fetch(
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!captionRes.ok) return null;
  const captionData = await captionRes.json();

  const text = (captionData.events || [])
    .filter((e) => e.segs)
    .map((e) => e.segs.map((s) => s.utf8 || "").join(""))
    .join(" ");

  return text.length > 20 ? text : null;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export default async (request) => {
  const store = getStore("smart-jobs");
  let jobId;

  try {
    const body = await request.json();
    const { url, jobId: clientJobId, manualTranscript } = body;

    jobId = clientJobId || crypto.randomUUID();
    await store.setJSON(jobId, { status: "starting", progress: 0 });

    await runJob(store, jobId, url, manualTranscript);
  } catch (err) {
    console.error("Job error:", err);
    if (jobId) {
      await store.setJSON(jobId, {
        status: "error",
        progress: 0,
        error: err.message || "Nieznany błąd",
      });
    }
  }
};

// ─── Main job ─────────────────────────────────────────────────────────────────

async function runJob(store, jobId, url, manualTranscript) {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error("Nieprawidłowy link YouTube");

  // 1. Transcript
  await store.setJSON(jobId, { status: "fetching_transcript", progress: 10 });

  let transcript = null;
  let transcriptSource = "none";

  if (manualTranscript && manualTranscript.trim().length > 20) {
    transcript = manualTranscript.trim().slice(0, 20_000);
    transcriptSource = "manual";
    console.log("Using manual transcript, length:", transcript.length);
  } else {
    // Próba 1: YouTube timedtext API (nie wymaga scrapingu strony)
    try {
      const raw = await fetchTranscriptTimedtext(videoId);
      if (raw) {
        transcript = raw.slice(0, 20_000);
        if (raw.length > 20_000) transcript += "\n\n[TRANSKRYPT UCIĘTY]";
        transcriptSource = "youtube";
        console.log("Timedtext transcript OK, length:", transcript.length);
      }
    } catch (err) {
      console.error("Timedtext transcript error:", err.message);
    }

    // Próba 2: youtube-transcript library (fallback)
    if (!transcript) try {
      const items = await YoutubeTranscript.fetchTranscript(videoId);
      if (items && items.length > 0) {
        const raw = items.map((t) => t.text).join(" ");
        transcript = raw.slice(0, 20_000);
        if (raw.length > 20_000) transcript += "\n\n[TRANSKRYPT UCIĘTY]";
        transcriptSource = "youtube";
        console.log("Library transcript OK, length:", transcript.length);
      }
    } catch (err) {
      console.error("Library transcript error:", err.message);
    }

    // Próba 3: Mac service (opcjonalny — działa gdy MIKRUS_AUDIO_URL skonfigurowane)
    if (!transcript && process.env.MIKRUS_AUDIO_URL) try {
      const MIKRUS_URL = process.env.MIKRUS_AUDIO_URL;
      const MIKRUS_SECRET = process.env.MIKRUS_AUDIO_SECRET;
      const res = await fetch(`${MIKRUS_URL}/captions?id=${videoId}&key=${MIKRUS_SECRET}`, { signal: AbortSignal.timeout(30000) });
      if (res.ok) {
        const data = await res.json();
        if (data.transcript && data.transcript.length > 20) {
          transcript = data.transcript.slice(0, 20_000);
          transcriptSource = "youtube";
          console.log("Mac service transcript OK, length:", transcript.length);
        }
      }
    } catch (err) {
      console.error("Mac service error:", err.message);
    }
  }

  if (!transcript) {
    await store.setJSON(jobId, {
      status: "error",
      progress: 0,
      error: "no_transcript",
    });
    return;
  }

  // 2. Metadata
  await store.setJSON(jobId, { status: "fetching_metadata", progress: 35 });
  const metadata = await fetchMetadata(videoId);

  // 3. AI Summary
  await store.setJSON(jobId, { status: "generating_summary", progress: 60 });
  const summary = await generateSummary(metadata, transcript);

  // 4. Done
  await store.setJSON(jobId, {
    status: "done",
    progress: 100,
    title: metadata.title,
    channel: metadata.channel,
    summary,
    transcriptSource,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractVideoId(url) {
  try {
    const u = new URL(url.trim());
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0];
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
  } catch {}
  return null;
}

async function fetchMetadata(videoId) {
  if (!YT_API_KEY) return { title: "Nieznany tytuł", channel: "Nieznany kanał" };

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YT_API_KEY}`
    );
    const data = await res.json();
    const item = data.items?.[0]?.snippet;
    return {
      title: item?.title || "Nieznany tytuł",
      channel: item?.channelTitle || "Nieznany kanał",
    };
  } catch {
    return { title: "Nieznany tytuł", channel: "Nieznany kanał" };
  }
}

async function generateSummary(metadata, transcript) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const prompt = `Jesteś ekspertem od analizy treści wideo. Tworzysz rzetelne, strukturalne podsumowania, które pozwalają szybko ocenić wartość materiału.

Wideo: "${metadata.title}"
Kanał: "${metadata.channel}"

Transkrypt:
${transcript}

---

Przeanalizuj transkrypt i odpowiedz WYŁĄCZNIE w poniższym formacie. Bez wstępu, bez komentarza po zakończeniu. Pisz w języku transkryptu.

## TL;DR
[1-2 zdania. Co to wideo mówi i dlaczego warto wiedzieć. Konkretnie — tak, żeby ktoś po przeczytaniu mógł zdecydować, czy oglądać.]

## Kluczowe punkty
- [konkretny fakt, argument lub insight — 1 zdanie]
- [konkretny fakt, argument lub insight — 1 zdanie]
- [konkretny fakt, argument lub insight — 1 zdanie]
(Dodaj 4. lub 5. punkt jeśli wideo jest bogate w treść. Pomiń ogólniki.)

## Główne wnioski
[2-3 zdania. Co nieoczywistego mówi autor? Co wynika z tego materiału? Czego nie da się wywnioskować z samego tytułu?]

## Co warto zapamiętać
1. [praktyczna wskazówka, ważny cytat lub kluczowy fakt]
2. [praktyczna wskazówka, ważny cytat lub kluczowy fakt]
3. [praktyczna wskazówka, ważny cytat lub kluczowy fakt]`;

  const chat = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2048,
    temperature: 0.3,
  });

  return chat.choices[0]?.message?.content || "Nie udało się wygenerować podsumowania.";
}
