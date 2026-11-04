# Advanced features: what is worth building, in what order

Be selective. Every extra feature adds testing, security work and complexity, and the product owner wants the site to stay **simple**. Use this table to decide.

| Priority | Item | Phase | Value | Risk or cost | Recommendation |
|---|---|---|---|---|---|
| Must before launch | Payments, accounts, security hardening, load tests, observability basics | 5, 6, 8 | Essential | Medium | Do first; pull the basic dashboards and alerts from Phase 16 into Phase 8 |
| Must before launch | Simple light UI, per-movie trailer, hover price, no boxes | 2b, 2c | High | Low | Already prepared |
| Strong differentiator | Best seats for me, comfort heatmap, view estimate, waitlist | 11 | High | Medium (wording must stay honest) | Next after the must-haves |
| Strong differentiator | Mobile app | 17 | High (most Indian bookings are on phones) | High | After Phase 8 and a real-phone 3D test |
| Good | Group booking and split payment | 10 | Medium to high | High (money logic) | After Phase 5 is rock solid |
| Good | Personalised discovery and natural-language search | 13 | Medium | Medium (privacy, model cost) | Start with the simple rule-based parts |
| Good | Invoices, saved payment tokens, refund tracker, gift cards | 15 | High for trust | Medium | Invoices and refund tracker before launch; gift cards later |
| Good for scale | Waiting room, feature flags, experiments, chaos drills | 16 | High on release days | Medium | Before a big marketing push |
| Nice to have | Sound preview, guided tour, compare view, share my view | 14 | Medium | Low to medium | Accessibility items in Phase 14 should be done early |
| Experimental | VR / WebXR preview | 14 | Low today | High | Keep behind a flag; skip for launch |
| Operations | Onboarding tool, entry scanning, at-seat orders, membership, transfers | 12 | High once you sign real cinemas | High | When real cinemas are on board |

## Things deliberately NOT recommended
- Price changes based on a person's data or device (unfair and a trust risk); dynamic pricing stays rule-based, capped and transparent.
- A public ticket resale marketplace (fraud, legal limits).
- Claiming a view is "clear" or "unobstructed", or that the sound preview matches the real room.
- Showing every metric to every user. Details stay behind a small link.

## Suggested order
2b (A and B) → 2c → 3 → 4 → 5 → 6 → 7 → 8 (with basic observability) → 11 → 15 (invoices and refunds) → 17 → 10 → 13 → 16 → 12 → 14 (accessibility first, extras later; VR last).
