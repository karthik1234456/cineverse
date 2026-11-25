import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.seed.seeder import generate_auditorium_layout

cases = [
    ('compact', 100, None),
    ('flagship', 560, None),
    ('balcony', 588, 'balcony_classical_triple'),
    ('balcony', 672, 'balcony_wide_promenade'),
    ('balcony', 432, 'balcony_compact_dual'),
    ('luxury_recliner', 64, 'recliner_intimate_242'),
    ('luxury_recliner', 80, 'recliner_executive_343'),
    ('luxury_recliner', 48, 'recliner_private_suite'),
    ('motion_seat', 240, 'motion_quad_pods'),
    ('motion_seat', 192, 'motion_dual_pods'),
    ('motion_seat', 264, 'motion_arena_pods'),
    ('motion_seat', 168, 'motion_compact_pods'),
    ('standard', 216, 'standard_wide_triple'),
    ('standard', 224, 'single_aisle'),
    ('standard', 216, 'continental'),
    ('standard', 140, 'compact_triple'),
]

all_match = True
for t, s, arr in cases:
    data, records = generate_auditorium_layout(t, s, is_3d_hall=(t=='compact'), arrangement=arr)
    seats_in_layout = len(data.get('seats', []))
    matched = (len(records) == s == seats_in_layout)
    if not matched:
        all_match = False
    print(f"{t:16} target={s:4} sig={data.get('layout_signature'):24} recs={len(records):4} layout_seats={seats_in_layout:4} MATCH={matched}")

print(f"\nALL VARIANTS MATCH: {all_match}")
