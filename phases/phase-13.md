# Phase 13 — Personalisation and smart discovery

> **Session preamble (paste at the top of every Antigravity session):**
> You are building CineVerse. FIRST read `CINEVERSE_WEBSITE_PROMPT.md`, `ANTIGRAVITY_PROMPT.md`, `DESIGN_SPEC.md` (light, simple, 18 px text, nothing under 14 px), `SECURITY_SPEC.md` and `docs/PROJECT_STATUS.md`. Do ONLY this phase. Run all earlier test suites first and fix regressions. Keep the product SIMPLE: every new feature must be optional, collapsed or clearly secondary, and must pass the simplicity budget in `DESIGN_SPEC.md`. Never mark an item done without evidence under `docs/evidence/phase-13/`. Diagnose failures, do not bypass them. At the end update `docs/PROJECT_STATUS.md`, write `docs/PHASE_13_REPORT.md` (PASS / FAIL / NOT DONE) and STOP for review.

**Entry gate:** Phases 1 to 7 passed; Phase 6 accounts working.

## Goal
Help people find a movie and a showtime in seconds, with recommendations they can understand and control.

## Tasks
1. **Natural-language search box:** "action movie tonight near me in Hindi", "something with the family on Saturday". Parse into structured filters (city, date/time window, language, genre, format, price cap, party size) using the same allow-listed tool approach as the voice agent: the model may only call search/filter tools and must never invent movies, times or prices. Show the interpreted filters as removable chips so the user can correct them. Fall back to the normal filters if parsing fails. Untrusted text (reviews, descriptions) is never treated as instructions.
2. **Recommendations (explainable, privacy-first):** start with simple, transparent methods (genre/language/cast affinity from the user's own bookings, watchlist and ratings, popularity in the city, similar-movie lists) before any machine learning. Every card says why ("Because you booked X"). Cold start for new users uses city trends. Users can see, reset and switch off personalisation; no personal data from other users is exposed; no price personalisation. Evaluate offline (precision at k on held-out bookings from seed data) and report numbers.
3. **Smart showtime picker:** "Best time for you" badges (usual time of day, less crowded, cheaper, preferred format), a "Plan my evening" suggestion (movie + time that leaves time to travel; no external routing needed, use cinema distance buckets), and "Show me nearby cinemas with seats together for N people" using seat availability.
4. **Review summaries:** a short, neutral summary of user reviews per movie (themes, spoiler-free) generated server-side with the review text treated strictly as data, clearly labelled "AI summary of N reviews", regenerated on a schedule, moderated, with a link to read the originals.
5. **Watchlist and alerts:** alerts for "tickets open", "price dropped", "seats freed" (builds on Phase 11 waitlist), per-user preferences and quiet hours, consent aware.
6. **Plain UI:** one clean search box, a "For you" row on the home page (max one extra row), no extra navigation items.

## Tests and evidence
Parser tests with 60 or more utterances in English, Hindi and Kannada (expected filters), a no-hallucination test (the answer must only contain items returned by tools), injection tests in reviews and descriptions, recommendation explainability tests, opt-out removes personalisation and deletes the profile data, cold-start behaviour, offline evaluation report, summary tests that fail if text outside the reviews appears.

## Security gate (see `SECURITY_SPEC.md`)
Prompt-injection isolation, per-user rate limits and spend caps on model calls, no PII sent to external model providers unless the person consented, data minimisation and deletion, audit log of model calls without sensitive content.

## Exit gate
A person can type a plain sentence, see correct editable filters and real results, understand every recommendation and turn personalisation off, with all tests passing.
