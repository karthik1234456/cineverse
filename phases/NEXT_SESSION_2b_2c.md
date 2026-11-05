# Next Antigravity session: fix the 3D visuals, then make the site light and simple

Paste everything below this line into a NEW Antigravity session (repo open, all earlier work committed).

---

You are working on CineVerse. Before anything else, run `git status` and commit or stash any uncommitted work, then run the full test suites (backend pytest, frontend Vitest, `tsc --noEmit`, Playwright) and record the pass counts. Do not change application code until you have those numbers.

You will do TWO tasks in this order, with a stop between them:

**TASK 1: `phases/phase-2b-visual-overhaul.md`, Part A (verification) and Part B (remove boxes, fix seat states) ONLY.**
Skip Parts C and D of that file; the next task replaces them. When Part A and Part B are finished, commit each part separately, write `docs/PHASE_2B_REPORT.md` (PASS / FAIL / NOT DONE with evidence), and **STOP and wait for my review**. Do not start Task 2 until I reply "continue".

**TASK 2 (only after I say "continue"): `phases/phase-2c-simple-light-ui.md`, all parts.**
Read `DESIGN_SPEC.md` first: it now defines the LIGHT, rich-colour theme, 18 px body text with nothing under 14 px, and the simplicity budget. Commit each Part separately, write `docs/PHASE_2C_REPORT.md`, tag `phase-2c-done` only if every gate passes, then STOP.

Rules for both tasks:
- Keep every existing behaviour, security rule, test and the seat numbering rule (seat 01 on the audience's left; always map by `node_name`).
- Never mark anything done without evidence in `docs/evidence/`. Report honestly what did not work, with numbers.
- No new features beyond the two files. Keep it simple.
- If something cannot be verified (for example no real phone is available), mark it UNVERIFIED and say why.
- Update `docs/PROJECT_STATUS.md` after each task.

When Task 1 is done, give me: the test counts before and after, the before/after screenshots of the 3D view, and the three biggest remaining problems you see.
