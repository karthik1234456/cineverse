# Tested reference implementations (pure TypeScript, zero dependencies)

| File | Purpose | Used by |
|---|---|---|
| `seatView.ts` | distance, horizontal/vertical angle, screen FOV, camera target, yaw/pitch, three.js camera rotation, geometric coverage | 3D POV, seat panel, 2D popover, Phase 11 scoring |
| `seatMapLayout.ts` | builds the standard 2D seat-map grid from the same seat records as the 3D scene | Phase 4 `SeatMap2D` |
| `walkCollision.ts` | first-person movement: capsule-vs-AABB sliding, tier/stair ground following, edge guard, sub-stepping, input mapping, eye smoothing | Walk mode |

Run (Node 22.18+ strips TypeScript types natively; no install needed):

```bash
node --test "frontend/tests/unit/*.test.ts"
```

Tests read the real `seat_layout_v2.json` and `walk_nav_v2.json`. 25 tests; verified to fail under four deliberate mutations (flipped angle sign, removed edge guard, removed sub-stepping, wrong three.js camera rotation).

Notes for the Next.js project:
- Tests import with a `.ts` extension (needed by Node's runner). In the app's `tsconfig.json` set `"allowImportingTsExtensions": true` (fine with `noEmit`), or let Vitest resolve them; do not rename the files.
- These modules assume the world conventions in `ANTIGRAVITY_PROMPT.md` (glTF Y-up, screen at -1.25 z, seats face +Z, right = -X, yaw 0 faces +Z, increasing yaw turns left). Extend them, keep the tests green, and add tests for anything you add. Do not re-derive the maths elsewhere.
- Collision samples ground at the player's centre point; the edge guard is therefore centre-based (documented, tested). Rendering-side smoothing of eye height uses `smoothEyeY`.
- Known limits: AABB-only colliders; no slopes; no jumping; the area behind row J is deliberately unreachable (model has no rear stairs).
