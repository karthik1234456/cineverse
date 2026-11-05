# CineVerse launch checklist (India)

This is a planning checklist, not legal, tax or financial advice. Confirm every item marked LEGAL or TAX with a qualified professional. Items marked YOU need a human decision; Antigravity cannot do them.

## 1. Business and legal (YOU, with a lawyer/CA)
- [ ] Register a business entity (LEGAL/TAX): company, LLP or proprietorship; PAN, bank account in the entity's name.
- [ ] GST registration and the correct tax treatment of ticket price, convenience fee and food (TAX). Put the rates in configuration; never hard-code.
- [ ] Contracts with every cinema (LEGAL): who sells the seats, revenue share, refund and cancellation responsibility, seat inventory feed, show cancellations, data ownership, 3D model rights.
- [ ] Content rights (LEGAL): written permission for every poster, still, trailer and synopsis from the distributor or rights holder; keep licences in the media table. Only seeded open-licence videos (with attribution) until then.
- [ ] Policies drafted by a professional: Terms of Use, Privacy Policy (DPDP Act aware: consent, purposes, retention, deletion, grievance officer with contact details), Refund and Cancellation Policy, Cookie notice.
- [ ] Check state rules on online ticketing, convenience-fee disclosure and entertainment tax (LEGAL). Do not enable ticket transfer or resale until cleared.
- [ ] Trademark search and filing for the name and logo; domain and social handles secured.

## 2. Payments (YOU)
- [ ] Razorpay business KYC and activation; settle account verified.
- [ ] Switch to live keys only after section 5 passes. Keys live only in the production secret store, never in the repo, chat, tool or frontend.
- [ ] Test one real small payment and one real refund end to end with your own card/UPI before opening to the public.
- [ ] Confirm the webhook URL, secret and signature verification in production; confirm reconciliation matches the first payout.

## 3. Product readiness (verify with Antigravity, then check yourself)
- [ ] All phases through 8 pass their exit and security gates (`phases/audit-progress.md` in report-only mode shows no Critical or High findings).
- [ ] No test-only bypass exists anywhere (search the code and history for test signatures and debug flags).
- [ ] Booking engine proven on **PostgreSQL** (concurrency test, unique constraint, hold expiry, late payment refund).
- [ ] Seat numbering identical in the 2D map, 3D scene, tickets and emails (seat 01 on the audience's left).
- [ ] Every claim in the UI is honest: viewing angles and sound are labelled approximate; nothing says "unobstructed" or "guaranteed".
- [ ] Text is readable everywhere (no text under 14 px), keyboard and screen-reader pass done, 3D works on at least one real mid-range Android phone and one iPhone, with the 2D map as the fallback.
- [ ] Support path exists: contact form, support email, a person who answers within a stated time, a refund-handling procedure.

## 4. Infrastructure and operations
- [ ] Production hosting chosen (India region recommended for latency and data residency questions), TLS certificates, HSTS, CDN for media and the 3D model, object storage for trailers.
- [ ] Separate environments (dev, staging, production); production secrets in a secret manager; least-privilege database roles; Redis not publicly reachable.
- [ ] Automated encrypted backups and a **tested restore** with a measured recovery time.
- [ ] Monitoring and alerts live (payment failures, webhook failures, hold sweeper, DB connections, error rate), with a named on-call person and a written runbook.
- [ ] Load test passed for the expected first-month traffic plus a release-day spike; waiting room ready if you expect spikes (Phase 16).
- [ ] Email and SMS providers set up with a verified sender domain (SPF, DKIM, DMARC) and DLT registration for SMS in India (confirm requirements with the provider).
- [ ] Feature flags created for risky features (voice agent, 3D extras, group booking, dynamic pricing) with kill switches.

## 5. Security sign-off (before live payments)
- [ ] Phase 8 security pass complete: ZAP baseline scan, header scan, dependency and container scans, secret scan over full git history, authorisation matrix, abuse tests (seat hoarding, coupon races, webhook replay and forgery).
- [ ] MFA enforced for all admin and cinema-manager accounts; default and demo accounts removed or disabled in production.
- [ ] A third-party penetration test or at least an independent review before opening to the public (recommended).
- [ ] Incident response plan written: who decides, how users are told, how a data-protection breach is reported as required by law (LEGAL).

## 6. Soft launch plan
- [ ] Invite-only beta with one or two cinemas and a few hundred users; staff present at the cinema entrance for the first shows.
- [ ] Watch dashboards daily for hold conflicts, payment failures, refunds, support tickets and 3D performance complaints.
- [ ] Fix, then widen in steps (10 percent, 50 percent, everyone) using feature flags; stop and roll back on any money or double-booking bug.
- [ ] Collect feedback with a simple in-app form; review it weekly.

## 7. After launch
- [ ] Monthly restore drill, dependency updates, key rotation schedule, privacy request handling within the legal time limit.
- [ ] Review the ranked list in `ADVANCED_BACKLOG.md` and pick the next feature from real user feedback, not guesses.
