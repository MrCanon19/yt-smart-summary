# YT Smart Summary

Structured YouTube video summaries in 4 sections, powered by Groq LLaMA (free tier).

**Live:** https://yt-smart-summary-mrcanon.netlify.app

## What it does

Paste a YouTube URL and get:

- **TL;DR** — 1-2 sentences capturing the core message
- **Key points** — 3-5 bullet points with concrete facts
- **Main insights** — what's non-obvious, what the title doesn't tell you
- **Remember** — 3 practical takeaways

Responds in the language of the video.

## Stack

- Frontend: vanilla JS, dark theme
- Backend: Netlify Functions (ESM) + Netlify Edge Functions
- AI: Groq `llama-3.3-70b-versatile` (free tier)
- Transcript: YouTube auto-captions (via Edge Function on Cloudflare)
- Job storage: Netlify Blobs

## Deploy your own

1. Fork this repo
2. Connect to Netlify
3. Add env vars:
   - `GROQ_API_KEY` — get free at [console.groq.com](https://console.groq.com)
   - `YOUTUBE_API_KEY` — optional, for video title/channel display

### Optional: Mac service for videos without captions

If a video has no auto-captions, the tool asks you to paste the transcript manually. Alternatively, run the Mac audio service from [yt-summarizer-o.mietek](https://github.com/MrCanon19/yt-summarizer-o.mietek) and set:
- `MIKRUS_AUDIO_URL` — ngrok URL of your local service
- `MIKRUS_AUDIO_SECRET` — auth secret
