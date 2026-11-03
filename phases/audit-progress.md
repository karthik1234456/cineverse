# CineVerse — Progress audit and resume prompt

Paste this whole file into a **new** Antigravity session whenever you want to know what is truly done and what to do next. It is safe to run any time. Default mode is **REPORT-ONLY**: do not change application code unless the final section says so.

> You are an independent QA lead and technical auditor. You did not write this code, so do not trust it, the status file, earlier reports or commit messages. A feature is DONE only if you personally ran it and saw it work. If you cannot verify something, mark it UNVERIFIED, never PASS. Be blunt and specific; optimism is a defect here.

## 0. Read first
`CINEVERSE_WEBSITE_PROMPT.md`, `ANTIGRAVITY_PROMPT.md`, `DESIGN_SPEC.md`, `SECURITY_SPEC.md`, `phases/00_RUNBOOK.md`, every `phases/phase-N.md`, `docs/PROJECT_STATUS.md`, every `docs/PHASE_N_REPORT.md`, and `git log --oneline --decorate` plus `git tag`.

## 1. Establish ground truth (run, do not assume)
1. Record environment: OS, Node, Python, Docker versions, current branch, last commit, uncommitted changes (`git status`). Flag a dirty tree.
2. From a clean state start the stack the documented way (`docker compose up` or the documented commands). Record: does it start, are health endpoints green, how long, any errors in logs.
3. Run **every** test suite that exists (backend pytest, frontend unit, Playwright E2E, lint, `tsc --noEmit`, build). Record command, pass/fail counts, duration and failures verbatim. If a suite does not exist where a phase demanded one, that is a finding.
4. Check that migrations apply from empty and roll back; seed twice and confirm no duplicates.
5. Verify the supplied assets are untouched: checksum `frontend/public/models/cineverse_auditorium_v2.glb`, and that `seat_layout_v2.json` and `walk_nav_v2.json` still contain 100 seats with `seat_id` ↔ `node_name` mapping (A05 ↔ `seat_A_06`, seat 01 on the audience's left).

## 2. Build the traceability matrix
For every phase (1 to 12) and every numbered task and exit-gate item in its prompt, create one row:

| Phase | Requirement (quote the short ID/text) | Code location (file:line or "none") | Test (name or "none") | Evidence file | Verified by me (Y/N) | Status |

Status values, strictly:
- **DONE**: implemented, covered by a passing test or reproducible manual check, evidence exists, and you reproduced it.
- **PARTIAL**: works only in part; list exactly what is missing.
- **STUBBED**: UI or API exists but returns mock/hardcoded data or does nothing real.
- **BROKEN**: implemented but fails.
- **NOT STARTED**
- **UNVERIFIED**: could not be checked (say why).

Also verify each phase's **Security gate** and **Exit gate** line by line.

## 3. Detect false completion (hunt actively)
Search the codebase and the running app for each of these and list every hit with file:line:
- Mock or hardcoded data where real data is required (seat availability in the frontend, fake payment success, fake auth, `TODO`, `FIXME`, `mock`, `stub`, `lorem ipsum`, placeholder text in shipped pages).
- Dead UI: buttons, links, menu items and forms that do nothing or lead nowhere (crawl every route with Playwright and click everything).
- Frontend trust problems: payment or booking success decided by the client, prices computed only on the client, secrets or Razorpay key secret in the bundle (search the built output), tokens in localStorage if cookies were required.
- Swallowed errors (`except: pass`, empty `catch`), disabled tests (`skip`, `xfail`, `.only`), tests that assert nothing, evidence screenshots that do not match the claimed state.
- Claims in reports that you cannot reproduce. Quote the claim and your result.
- 3D specifics: coordinate assertion at startup exists and passes; camera at seat POV equals `eye_position_gltf_y_up` within 0.001 and looks at the screen centre; no wording claims a view is "unobstructed"; the original GLB geometry is unmodified; trailer plays on the screen texture (two frames differ); walk mode cannot clip through seats, walls or the stage lip or drop off tier edges; 2D map and 3D share selection and hold state.

## 4. Regression and quality checks
- Re-run each earlier phase's exit-gate scenario end to end. A later phase breaking an earlier one is a regression finding with the commit that likely caused it (`git bisect` if needed).
- The core journey from the website prompt: city → movie → showtime → 2D seat map → (3D button) → select → hold → add-ons → coupon → Razorpay test payment → QR ticket → profile history. Run it, record every step PASS/FAIL with a screenshot.
- Concurrency check if Phase 4 is claimed done: many parallel clients on one seat, exactly one wins; expired hold cannot become a booking.
- Performance snapshot: Lighthouse mobile on home, movie detail and the 2D seat map; 3D route frame time and `renderer.info` triangle count compared with the numbers in `docs/3d-performance.md`.
- Accessibility snapshot: axe on key pages; keyboard-only run of the booking journey.
- Security snapshot against `SECURITY_SPEC.md`: security headers on the running app, authZ matrix spot checks (customer vs admin vs another user's booking), dependency audits (`npm audit`, `pip-audit`), secret scan (gitleaks) over the full history.

## 5. Output (write these files, then stop)
1. `docs/AUDIT_REPORT_<YYYY-MM-DD>.md` containing:
   - **Executive summary** in 10 lines: overall completion %, what works today, what is blocking, biggest risks.
   - Environment and ground-truth results (section 1).
   - The full traceability matrix (section 2) and a per-phase summary table: phase, DONE / PARTIAL / STUBBED / BROKEN / NOT STARTED counts, gate PASS or FAIL.
   - False-completion findings (section 3) with severity: **Critical** (money, security, data loss, double booking), **High** (core journey broken), **Medium**, **Low**.
   - Regression and quality results (section 4) with numbers.
   - **Discrepancies** between `docs/PROJECT_STATUS.md` / phase reports and reality.
   - A prioritised fix list: ID, severity, description, where, suggested fix, estimated effort (S/M/L).
   - **Recommendation:** exactly one of: `CONTINUE to Phase N` (all earlier gates PASS), `FIX FIRST` (list the blocking items), or `REDO Phase N` (explain). Never recommend moving on while a Critical or High finding is open in an earlier phase.
2. Update `docs/PROJECT_STATUS.md` so each phase shows the audited status (not-started / in-progress / done-verified / done-with-issues), with the date and a link to the audit report. Do not mark a phase done-verified unless its exit gate and security gate both PASS in your own run.
3. Save evidence (command outputs, screenshots, test reports) under `docs/evidence/audit-<date>/`.
4. Print a final chat message: the executive summary, the recommendation, and the five most important next actions.

## 6. Next-step prompt generation
After the report, generate `docs/NEXT_SESSION_PROMPT.md`: a ready-to-paste prompt for the next Antigravity session that (a) states the audited state in a few lines, (b) lists the exact failing or missing items to fix first with file paths and the failing test names, (c) then names the next phase file to run once those pass, and (d) repeats the rule "stop at the exit gate and wait for review".

## 7. Rules
- Report-only: do not edit application code, tests or specs in this session. The only files you may create or modify are the audit report, `docs/PROJECT_STATUS.md`, `docs/NEXT_SESSION_PROMPT.md` and the evidence folder.
- Do not "fix" a failing test by weakening it. Do not delete findings to make the report look better.
- Never print or store secrets from `.env` files in the report; refer to them by name only.
- If the stack cannot start, that is itself the main finding: report it, show the logs, and skip checks that depend on it, marking them UNVERIFIED.
- Time-box: if something takes more than about 10 minutes to verify, mark it UNVERIFIED with the reason and move on.
- Be specific: file paths, line numbers, command output, screenshot names. Vague statements like "seems fine" are not acceptable.

## Optional FIX MODE (only if the person asks in their message)
If, and only if, the message that pasted this prompt also says "FIX MODE", then after writing the report fix the **Critical and High** findings one at a time, in priority order, each as a separate git commit with a test proving the fix, re-run the affected suites, update the report with before/after results, and stop. Do not start the next phase and do not make unrelated changes.
