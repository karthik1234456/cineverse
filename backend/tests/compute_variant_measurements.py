#!/usr/bin/env python3
"""
Compute Real-World Architectural Measurements Across All Cinema Hall Variants
=============================================================================
Calculates:
- Documented scale: 1.0 m = 2.0 scene units (METERS_TO_SCENE = 2.0, SCENE_TO_METERS = 0.5)
- Compact hall reference conversion (~0.43m per GLB unit)
- Seat pitch (cm), chair width (cm), visible gap between chairs (cm)
- Row pitch (cm)
- Rake step (cm)
- First-row distance to screen (m)
- FOV Front row (deg) and FOV Back row (deg)
Outputs Markdown summary table for documentation and reports.
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.theatre_type_registry import THEATRE_TYPES, METERS_TO_SCENE, SCENE_TO_METERS
from app.seed.seeder import generate_auditorium_layout


def calculate_screen_fov(dist_m, screen_w_m):
    return round(2.0 * math.atan((screen_w_m / 2.0) / dist_m) * 180.0 / math.pi, 1)


def generate_measurements_report():
    variants = [
        # (type, total_seats, arrangement, variant_label)
        ("compact", 100, None, "Compact Hall (Reference 100-seat)"),
        ("standard", 216, "standard_wide_triple", "Standard Multiplex — Wide Triple Block (4-10-4)"),
        ("standard", 224, "standard_single_aisle", "Standard Multiplex — Center Aisle (8-8)"),
        ("standard", 216, "standard_continental", "Standard Multiplex — Continental (18)"),
        ("standard", 140, "standard_compact_triple", "Standard Multiplex — Compact Stadium (3-8-3)"),
        ("balcony", 588, "balcony_classical_triple", "Grand Balcony — Classical Dual-Tier (7-14-7)"),
        ("balcony", 672, "balcony_wide_promenade", "Grand Balcony — Wide Promenade (6-16-6)"),
        ("balcony", 432, "balcony_compact_dual", "Grand Balcony — Compact Dual-Tier (6-12-6)"),
        ("luxury_recliner", 64, "recliner_intimate_242", "VIP Recliner Lounge — Intimate Pairs (2-4-2)"),
        ("luxury_recliner", 80, "recliner_executive_343", "VIP Recliner Lounge — Executive Suite (3-4-3)"),
        ("luxury_recliner", 48, "recliner_private_suite", "VIP Recliner Lounge — Private Club (2-4-2)"),
        ("motion_seat", 240, "motion_quad_pods", "Motion-Seat Experience — Quad Pods (4-12-4)"),
        ("motion_seat", 192, "motion_dual_pods", "Motion-Seat Experience — Dual Pods (4-8-4)"),
        ("motion_seat", 264, "motion_arena_pods", "Motion-Seat Experience — Arena Pods (6-10-6)"),
        ("motion_seat", 168, "motion_compact_pods", "Motion-Seat Experience — Compact Pods (4-6-4)"),
        ("flagship", 560, None, "Flagship Large Format — Curved Stadium (7-14-7)"),
        ("large", 420, None, "Large Format Cinema — Triple Block (7-14-7)"),
        ("boutique", 48, None, "Boutique Velvet Salon — Plush Club (4-4)"),
    ]

    records = []

    for tid, seats, arr, label in variants:
        tdef = THEATRE_TYPES.get(tid, THEATRE_TYPES["standard"])
        ldata, seat_recs = generate_auditorium_layout(tid, seats, is_3d_hall=(tid == "compact"), arrangement=arr)

        is_compact = (tid == "compact")
        scale = 0.43 if is_compact else SCENE_TO_METERS

        # Screen dimensions in metres
        if is_compact:
            screen_w_m = 15.6 * 0.43  # ~6.71m
            screen_h_m = 7.25 * 0.43  # ~3.12m
            screen_z_m = -1.255 * 0.43
            chair_w_cm = 45.0
            chair_gap_cm = 10.0
            seat_pitch_cm = 55.0
            row_pitch_cm = 105.0
            rake_step_cm = 18.0
        else:
            rw = tdef.get("real_world", {})
            screen_w_m = rw.get("screen_width_m", 14.0)
            screen_h_m = rw.get("screen_height_m", 6.5)
            chair_w_cm = round(rw.get("seat_width_m", 0.52) * 100.0, 1)
            # Visible gap between chairs
            if tid == "luxury_recliner":
                chair_gap_cm = 16.0  # swivel cocktail tray + arm console
                seat_pitch_cm = chair_w_cm + chair_gap_cm
            else:
                chair_gap_cm = 8.0   # armrest & beverage cup space
                seat_pitch_cm = chair_w_cm + chair_gap_cm
            row_pitch_cm = round(rw.get("row_pitch_m", 1.0) * 100.0, 1)
            rake_step_cm = round(rw.get("rake_step_m", 0.17) * 100.0, 1)

        # Distances to screen from seat records
        row_a_seats = [s for s in seat_recs if s["row"] == ldata["rows"][0]]
        row_last_seats = [s for s in seat_recs if s["row"] == ldata["rows"][-1]]

        center_a = row_a_seats[len(row_a_seats) // 2]
        center_last = row_last_seats[len(row_last_seats) // 2]

        # Convert scene units to real metres if needed
        first_row_dist_m = round(center_a["distance_to_screen"] * (scale if is_compact else 0.5), 2)
        last_row_dist_m = round(center_last["distance_to_screen"] * (scale if is_compact else 0.5), 2)

        fov_front = calculate_screen_fov(first_row_dist_m, screen_w_m)
        fov_back = calculate_screen_fov(last_row_dist_m, screen_w_m)

        records.append({
            "type": tid,
            "signature": ldata.get("layout_signature", arr or "default"),
            "label": label,
            "seats": len(seat_recs),
            "rows": len(ldata["rows"]),
            "blocks": "-".join(str(b) for b in ldata.get("blocks_pattern", [])),
            "seat_width_cm": chair_w_cm,
            "chair_gap_cm": chair_gap_cm,
            "seat_pitch_cm": seat_pitch_cm,
            "row_pitch_cm": row_pitch_cm,
            "rake_step_cm": rake_step_cm,
            "screen_w_m": screen_w_m,
            "screen_h_m": screen_h_m,
            "first_row_dist_m": first_row_dist_m,
            "last_row_dist_m": last_row_dist_m,
            "fov_front_deg": fov_front,
            "fov_back_deg": fov_back,
        })

    print("\n================ CINEMA HALL ARCHITECTURAL MEASUREMENTS ================")
    print(f"Documented Constant: 1.0 m = {METERS_TO_SCENE} scene units (SCENE_TO_METERS = {SCENE_TO_METERS})")
    print(f"Compact Hall Scale: 1.0 unit = 0.43 m (GLB historical reference)")
    print(f"Variants Analyzed: {len(records)}\n")

    md_lines = [
        "# Cinema Hall Architectural Measurements by Variant\n",
        f"**Scale Specification**:",
        f"- `1.0 m = {METERS_TO_SCENE} scene units` (`METERS_TO_SCENE = 2.0`, `SCENE_TO_METERS = 0.50`) across all procedural files.",
        f"- Historical Compact Hall GLB conversion: `1.0 unit = 0.43 m` (documented exception for bespoke demonstration asset).\n",
        "| Variant Label | Layout Signature | Seats | Rows | Block Pattern | Chair Width (cm) | Chair Gap (cm) | Seat Pitch (cm) | Row Pitch (cm) | Rake Step (cm) | 1st Row Dist (m) | FOV Front | FOV Back |",
        "| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |",
    ]

    for r in records:
        md_lines.append(
            f"| {r['label']} | `{r['signature']}` | {r['seats']} | {r['rows']} | {r['blocks']} | {r['seat_width_cm']} | {r['chair_gap_cm']} | {r['seat_pitch_cm']} | {r['row_pitch_cm']} | {r['rake_step_cm']} | {r['first_row_dist_m']} m | {r['fov_front_deg']}° | {r['fov_back_deg']}° |"
        )

    md_text = "\n".join(md_lines)
    out_file = Path(__file__).resolve().parent / "variant_measurements_table.md"
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(md_text)
    print(f"Report written to: {out_file}")
    return records


if __name__ == "__main__":
    generate_measurements_report()
