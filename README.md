# Mira Dental Studio

A concept website for a **fictional** dental clinic in Beirut, built as a portfolio project by Mohamad Jardani.
The clinic, team and phone number are made up.

**What it shows**

- A marketing site in **English, Arabic (RTL) and French**: services with prices, team, opening hours, and contact.
- **Online booking** with live availability. All rules are enforced on the server:
  - opening hours and each dentist's working days
  - service length and 60-minute notice
  - a 30-day booking window
  - no double booking (Postgres advisory locks)
- **Manage a booking** with a code and phone number: reschedule or cancel. The confirmation also offers an `.ics` calendar file.
- **Mira, an AI receptionist** that runs on free LLM tiers:
  - answers questions about the clinic
  - finds open days and times
  - books, moves and cancels appointments by calling the same server functions the website uses
  - supports voice input and spoken replies in the browser
- **Front desk dashboard** (`/en/admin`) with upcoming visits, load per dentist, revenue, and AI transcripts. Names and phone numbers are masked in demo mode.

## Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS v4
- Motion
- zod
- postgres.js
- Vitest

The AI layer is provider-agnostic:

- Gemini over REST (function calling)
- any OpenAI-compatible API (Groq, OpenRouter, Ollama)
- automatic fallback when one provider is rate-limited or unavailable

## Run locally

```bash
npm install
cp .env.example .env.local   # optional: add a free Gemini or Groq key
npm run dev                  # http://localhost:3000
npm test                     # booking rules + agent loop tests
```

## Deploy (free)

1. Push to GitHub and import the repo in Vercel.
2. Add `GEMINI_API_KEY` (from Google AI Studio) and, optionally, `GROQ_API_KEY` as a fallback.
3. Optional: add `DATABASE_URL` from Neon or Supabase so bookings persist.

See `.env.example` for every setting.

## Project layout

```
lib/clinic.ts        clinic data: hours, services, dentists (en/ar/fr)
lib/bookings.ts      availability + booking rules (single source of truth)
lib/store.ts         in-memory or Postgres storage
lib/agent/           LLM providers, tools, agent loop, chat limits
app/[locale]/        pages (home, services, dentists, book, manage, contact, admin)
app/api/             slots, open days, bookings, chat, admin login
components/          UI, booking wizard, chat widget
```
