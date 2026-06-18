# YT Smart Summary

Wklej link do wideo YouTube i otrzymaj rzetelne podsumowanie w 4 sekcjach. Za darmo.

**Demo:** https://smart-yt-summary.netlify.app

---

## Co robi

Analizuje transkrypt wideo i zwraca:

- **TL;DR** — 1–2 zdania oddające sedno. Czytasz i wiesz, czy warto oglądać.
- **Kluczowe punkty** — 3–5 konkretnych faktów lub argumentów z wideo
- **Główne wnioski** — co nieoczywistego mówi autor, czego nie zdradza tytuł
- **Co warto zapamiętać** — 3 praktyczne wskazówki lub kluczowe fakty

Odpowiada w języku wideo (polskie wideo → polskie podsumowanie).

## Jak działa

1. Podajesz link do YouTube
2. Aplikacja pobiera napisy i wysyła je do AI
3. Dostajesz gotowe podsumowanie w kilkanaście sekund

Jeśli wideo nie ma automatycznych napisów, aplikacja poprosi o ręczne wklejenie transkryptu (YouTube → menu ⋯ → Pokaż transkrypt).

## Stack

- Frontend: vanilla JS, dark theme
- Backend: Netlify Functions (background, ESM) + Netlify Edge Functions
- AI: Groq `llama-3.3-70b-versatile` (darmowy tier)
- Storage: Netlify Blobs (przechowywanie stanu zadań)

## Uruchom własną instancję

**Wymagania:** konto Netlify (darmowe), klucz Groq API (darmowy)

```bash
git clone https://github.com/MrCanon19/yt-smart-summary
cd yt-smart-summary
```

Połącz repo z Netlify i dodaj zmienne środowiskowe:

| Zmienna | Opis | Wymagana |
|---|---|---|
| `GROQ_API_KEY` | Klucz API Groq — pobierz na [console.groq.com](https://console.groq.com) | tak |
| `YOUTUBE_API_KEY` | Klucz YouTube Data API v3 — do wyświetlania tytułu i kanału | nie |
