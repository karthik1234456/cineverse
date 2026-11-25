# Cinema Hall Architectural Measurements by Variant

**Scale Specification**:
- `1.0 m = 2.0 scene units` (`METERS_TO_SCENE = 2.0`, `SCENE_TO_METERS = 0.50`) across all procedural files.
- Historical Compact Hall GLB conversion: `1.0 unit = 0.43 m` (documented exception for bespoke demonstration asset).

| Variant Label | Layout Signature | Seats | Rows | Block Pattern | Chair Width (cm) | Chair Gap (cm) | Seat Pitch (cm) | Row Pitch (cm) | Rake Step (cm) | 1st Row Dist (m) | FOV Front | FOV Back |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Compact Hall (Reference 100-seat) | `compact_reference` | 100 | 10 | 3-4-3 | 45.0 | 10.0 | 55.0 | 105.0 | 18.0 | 1.38 m | 135.3° | 83.3° |
| Standard Multiplex — Wide Triple Block (4-10-4) | `standard_wide_triple` | 216 | 12 | 4-10-4 | 52.0 | 8.0 | 60.0 | 100.0 | 17.0 | 9.63 m | 72.0° | 38.2° |
| Standard Multiplex — Center Aisle (8-8) | `standard_single_aisle` | 224 | 14 | 8-8 | 52.0 | 8.0 | 60.0 | 100.0 | 17.0 | 9.67 m | 71.8° | 35.0° |
| Standard Multiplex — Continental (18) | `standard_continental` | 216 | 12 | 18 | 52.0 | 8.0 | 60.0 | 100.0 | 17.0 | 9.63 m | 72.0° | 38.2° |
| Standard Multiplex — Compact Stadium (3-8-3) | `standard_compact_triple` | 140 | 10 | 3-8-3 | 52.0 | 8.0 | 60.0 | 100.0 | 17.0 | 9.63 m | 72.0° | 42.0° |
| Grand Balcony — Classical Dual-Tier (7-14-7) | `balcony_classical_triple` | 588 | 21 | 7-14-7 | 54.0 | 8.0 | 62.0 | 105.0 | 20.0 | 15.1 m | 72.1° | 34.3° |
| Grand Balcony — Wide Promenade (6-16-6) | `balcony_wide_promenade` | 672 | 24 | 6-16-6 | 54.0 | 8.0 | 62.0 | 105.0 | 20.0 | 15.1 m | 72.1° | 31.6° |
| Grand Balcony — Compact Dual-Tier (6-12-6) | `balcony_compact_dual` | 432 | 18 | 6-12-6 | 54.0 | 8.0 | 62.0 | 105.0 | 20.0 | 15.1 m | 72.1° | 37.4° |
| VIP Recliner Lounge — Intimate Pairs (2-4-2) | `recliner_intimate_242` | 64 | 8 | 2-4-2 | 92.0 | 16.0 | 108.0 | 142.0 | 22.0 | 8.95 m | 72.0° | 38.7° |
| VIP Recliner Lounge — Executive Suite (3-4-3) | `recliner_executive_343` | 80 | 8 | 3-4-3 | 92.0 | 16.0 | 108.0 | 142.0 | 22.0 | 8.95 m | 72.0° | 38.7° |
| VIP Recliner Lounge — Private Club (2-4-2) | `recliner_private_suite` | 48 | 6 | 2-4-2 | 92.0 | 16.0 | 108.0 | 142.0 | 22.0 | 8.95 m | 72.0° | 44.9° |
| Motion-Seat Experience — Quad Pods (4-12-4) | `motion_quad_pods` | 240 | 12 | 4-12-4 | 56.0 | 8.0 | 64.0 | 125.0 | 24.0 | 11.02 m | 72.0° | 36.5° |
| Motion-Seat Experience — Dual Pods (4-8-4) | `motion_dual_pods` | 192 | 12 | 4-8-4 | 56.0 | 8.0 | 64.0 | 125.0 | 24.0 | 11.02 m | 72.0° | 36.5° |
| Motion-Seat Experience — Arena Pods (6-10-6) | `motion_arena_pods` | 264 | 12 | 6-10-6 | 56.0 | 8.0 | 64.0 | 125.0 | 24.0 | 11.02 m | 72.0° | 36.5° |
| Motion-Seat Experience — Compact Pods (4-6-4) | `motion_compact_pods` | 168 | 12 | 4-6-4 | 56.0 | 8.0 | 64.0 | 125.0 | 24.0 | 11.02 m | 72.0° | 36.5° |
| Flagship Large Format — Curved Stadium (7-14-7) | `curved_flagship` | 560 | 20 | 7-14-7 | 58.0 | 8.0 | 66.0 | 110.0 | 20.0 | 15.44 m | 70.9° | 34.6° |
| Large Format Cinema — Triple Block (7-14-7) | `large_format_triple` | 420 | 15 | 7-14-7 | 56.0 | 8.0 | 64.0 | 105.0 | 19.0 | 13.78 m | 71.9° | 39.5° |
| Boutique Velvet Salon — Plush Club (4-4) | `boutique_salon` | 48 | 6 | 4-4 | 90.0 | 8.0 | 98.0 | 135.0 | 16.0 | 8.31 m | 71.7° | 44.2° |