#!/usr/bin/env python3
"""Derive walk_nav_v2.json (walkable surfaces + collision boxes) from the GLB.
All boxes are AABBs in glTF Y-up world space (same convention as seat_layout_v2.json:
screen at z~-1.25, audience at more negative Z, seats face +Z, viewer's right = -X).
Usage: python tools/generate_walk_nav.py frontend/public/models/cineverse_auditorium_v2.glb
"""
import json, struct, sys, re
import numpy as np
UNIT_TO_M = 0.43
def load(p):
    f = open(p, "rb").read(); c = struct.unpack("<I", f[12:16])[0]
    return json.loads(f[20:20 + c]), f[20 + c + 8:]
def box(j, b, n):
    p = j["meshes"][n["mesh"]]["primitives"][0]; a = j["accessors"][p["attributes"]["POSITION"]]; bv = j["bufferViews"][a["bufferView"]]
    v = np.frombuffer(b, "<f4", a["count"] * 3, bv.get("byteOffset", 0) + a.get("byteOffset", 0)).reshape(-1, 3)
    mn, mx = v.min(0), v.max(0)   # Blender-style (x, y_depth, z_up) -> glTF (x, z, -y)
    lo = [mn[0], mn[2], -mx[1]]; hi = [mx[0], mx[2], -mn[1]]
    return {"min": [round(float(x), 3) for x in lo], "max": [round(float(x), 3) for x in hi]}
j, b = load(sys.argv[1])
N = {n["name"]: n for n in j["nodes"] if "mesh" in n}
walk, coll = [], []
for k, n in N.items():
    if k == "room_floor": walk.append({"name": k, "kind": "floor", **box(j, b, n)})
    elif k.startswith("tier_platform_"): walk.append({"name": k, "kind": "tier", **box(j, b, n)})
    elif k.startswith("central_aisle_tread_"): walk.append({"name": k, "kind": "tread", **box(j, b, n)})
    elif re.match(r"(left_wall|right_wall|front_wall|back_wall|screen_stage_lip|screen_outer_frame|cinema_screen_surface|speaker_tower_|rail_post_|exit_door_)", k):
        coll.append({"name": k, "kind": "static", **box(j, b, n)})
    elif k.startswith("seat_"):
        _, row, num = k.split("_")
        coll.append({"name": k, "seat_id": f"{row}{11 - int(num):02d}", "kind": "seat", **box(j, b, n)})
out = {
  "version": 1, "generated_from": "cineverse_auditorium_v2.glb (derived)",
  "coordinate_system": "glTF Y-up. Screen z~-1.25; audience at more negative Z; seats face +Z; viewer's right is -X.",
  "player": {"radius": 0.30, "standing_eye_height_units": round(1.62 / UNIT_TO_M, 2),
             "note": "1.62 m eye height / 0.43 m-per-unit ESTIMATE. Radius 0.30u ~13 cm is deliberately small; clear central aisle is ~1.12u wide.",
             "max_step_up": 0.30, "max_step_down": 0.40, "tier_rise": 0.22,
             "walk_speed_units_per_s": 3.0, "run_speed_units_per_s": 6.0,
             "spawn": {"position": [0.0, 0.0, -5.5], "yaw_facing": "-Z (looking up the aisle toward the seats)"}},
  "notes": ["Rows are 1.5u apart (z) with ~0.98u deep seats -> only ~0.52u between rows: seats are solid obstacles; walk via aisles.",
            "Central aisle: x in [-0.56, 0.56] clear between seat blocks (seats 05/06 at x=-1.2/+1.2, half width 0.64). Side aisles: x in ~[6.64, 10.69].",
            "Tier platforms are x[-8.1,8.1], 1.5u deep per row, 0.22u rise. Edges that drop > max_step_down must act as invisible walls.",
            "Behind row J (z < -22.35) the floor is at y~0 while row J is at y=2.2: not reachable by walking; treat as no-go (add invisible guard).",
            "Stage lip top y~1.56 at z[-1.33,-0.68]: not climbable (step > max_step_up)."],
  "walkable": walk, "colliders": coll,
}
json.dump(out, open("frontend/public/models/walk_nav_v2.json", "w"), indent=1)
print(len(walk), "walkable;", len(coll), "colliders;", sum(c["kind"] == "seat" for c in coll), "seats")
