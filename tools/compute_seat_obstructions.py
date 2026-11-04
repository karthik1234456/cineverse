#!/usr/bin/env python3
"""Compute geometric view obstruction estimates per seat against static theatre geometry.

Raycasts from each seat's adult eye position to a grid of points across the screen surface,
intersecting with static colliders (seats ahead, stage lip, speaker towers, rails).

Outputs: frontend/public/models/seat_obstructions.json
"""
import json
import math
from datetime import datetime
from pathlib import Path


def ray_box_intersect(origin, direction, box_min, box_max):
    """Slab method for ray-AABB intersection. Returns True if ray hits box for t in [0.01, 0.99]."""
    tmin = 0.01
    tmax = 0.99

    for i in range(3):
        inv_d = 1.0 / direction[i] if direction[i] != 0.0 else 1e9
        t0 = (box_min[i] - origin[i]) * inv_d
        t1 = (box_max[i] - origin[i]) * inv_d
        if inv_d < 0.0:
            t0, t1 = t1, t0
        tmin = max(tmin, t0)
        tmax = min(tmax, t1)
        if tmax < tmin:
            return False
    return True


def main():
    root = Path(__file__).resolve().parent.parent
    layout_path = root / "frontend" / "public" / "models" / "seat_layout_v2.json"
    nav_path = root / "frontend" / "public" / "models" / "walk_nav_v2.json"
    out_path = root / "frontend" / "public" / "models" / "seat_obstructions.json"

    with open(layout_path, "r", encoding="utf-8") as f:
        layout_data = json.load(f)

    with open(nav_path, "r", encoding="utf-8") as f:
        nav_data = json.load(f)

    seats = layout_data["seats"]
    colliders = nav_data.get("colliders", [])

    # Screen grid points (9 horizontal x 5 vertical = 45 sample points)
    # Screen is at z = -1.255, width 15.6, height 7.25, center (0, 5.55, -1.255)
    xs = [-7.0, -5.25, -3.5, -1.75, 0.0, 1.75, 3.5, 5.25, 7.0]
    ys = [2.5, 4.0, 5.55, 7.0, 8.5]
    screen_z = -1.255
    screen_points = [[x, y, screen_z] for y in ys for x in xs]
    total_samples = len(screen_points)

    obstructions = {}

    for seat in seats:
        seat_id = seat["seat_id"]
        node_name = seat["node_name"]
        eye = seat["eye_position_gltf_y_up"]
        seat_z = eye[2]

        # Consider only colliders strictly in front of this seat's eye (closer to screen, i.e. z > seat_z + 0.1)
        # Exclude this seat's own collider
        relevant_colliders = []
        for c in colliders:
            if c.get("name") == node_name:
                continue
            b = c["bounds"]
            # Screen is at z = -1.255. Eye is at z < -7. Forward is +Z.
            # Colliders that could obstruct must have min_z > seat_z
            if b["max"][2] > seat_z + 0.1:
                relevant_colliders.append(c)

        unblocked_count = 0
        hit_elements = set()

        for pt in screen_points:
            # Ray from eye to pt
            origin = eye
            direction = [pt[0] - eye[0], pt[1] - eye[1], pt[2] - eye[2]]

            is_blocked = False
            for col in relevant_colliders:
                b = col["bounds"]
                if ray_box_intersect(origin, direction, b["min"], b["max"]):
                    is_blocked = True
                    hit_elements.add(col["name"])
                    break

            if not is_blocked:
                unblocked_count += 1

        visibility_pct = round((unblocked_count / total_samples) * 100.0, 1)

        # Classify obstruction level
        if visibility_pct >= 99.0:
            assessment = "Full geometric line of sight to screen"
        elif visibility_pct >= 90.0:
            assessment = "Minor peripheral framing interference"
        else:
            assessment = "Partial lower screen cutoff by front elements"

        obstructions[seat_id] = {
            "seat_id": seat_id,
            "node_name": node_name,
            "visible_percentage": visibility_pct,
            "obstructed_percentage": round(100.0 - visibility_pct, 1),
            "unblocked_rays": unblocked_count,
            "total_rays": total_samples,
            "obstructing_elements": sorted(list(hit_elements)),
            "assessment": assessment,
            "disclaimer": "Geometric raycast estimate against static theatre geometry only. No audience members or physical heads modelled."
        }

    output_payload = {
        "model_version": "v2.0",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "sample_grid": {"horizontal": 9, "vertical": 5, "total_samples": total_samples},
        "disclaimer": "Geometric raycast estimate against static theatre geometry only. No audience members or physical heads modelled.",
        "seats": obstructions
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, indent=2)

    print(f"Successfully computed obstruction estimates for {len(obstructions)} seats -> {out_path}")


if __name__ == "__main__":
    main()

