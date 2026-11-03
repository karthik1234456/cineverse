#!/usr/bin/env python3
"""Derive walk_nav_v2.json directly from the GLB (glTF binary).

Extracts:
1. Walkable surfaces: room_floor, 10 tier_platform_*, 10 central_aisle_tread_*
2. Colliders:
   - Walls (front_wall, back_wall, left_wall, right_wall)
   - Screen outer frame (screen_outer_frame)
   - Screen stage lip (screen_stage_lip)
   - Speaker towers (speaker_tower_L, speaker_tower_R)
   - Rail posts (rail_post_L_*, rail_post_R_*)
   - 100 seat bounding boxes (seat_A_01 .. seat_J_10)
3. Player parameters: radius, standing_eye_height, speeds, step limits, spawn position

Usage:
  python tools/generate_walk_nav.py frontend/public/models/cineverse_auditorium_v2.glb
"""
import json
import struct
import sys
import numpy as np

def load(path):
    f = open(path, "rb").read()
    clen = struct.unpack("<I", f[12:16])[0]
    j = json.loads(f[20:20 + clen])
    b = f[20 + clen + 8:]
    return j, b

def verts(j, b, node):
    p = j["meshes"][node["mesh"]]["primitives"][0]
    a = j["accessors"][p["attributes"]["POSITION"]]
    bv = j["bufferViews"][a["bufferView"]]
    return np.frombuffer(
        b, "<f4", a["count"] * 3,
        bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    ).reshape(-1, 3)

def to_gltf_box(mn, mx):
    # Blender (x, y_depth, z_up) -> glTF Y-up: (x, z_up, -y_depth)
    return {
        "min": [round(float(mn[0]), 3), round(float(mn[2]), 3), round(float(-mx[1]), 3)],
        "max": [round(float(mx[0]), 3), round(float(mx[2]), 3), round(float(-mn[1]), 3)]
    }

def main(path):
    j, b = load(path)
    nodes = {n["name"]: n for n in j["nodes"]}

    # 1. Walkable surfaces
    walkable = []

    # Floor
    if "room_floor" in nodes:
        v = verts(j, b, nodes["room_floor"])
        box = to_gltf_box(v.min(0), v.max(0))
        walkable.append({
            "name": "room_floor",
            "type": "floor",
            "bounds": box,
            "top_y": box["max"][1]
        })

    # 10 Tier platforms (A to J)
    for r in "ABCDEFGHIJ":
        name = f"tier_platform_{r}"
        if name in nodes:
            v = verts(j, b, nodes[name])
            box = to_gltf_box(v.min(0), v.max(0))
            walkable.append({
                "name": name,
                "type": "tier",
                "row": r,
                "bounds": box,
                "top_y": box["max"][1]
            })

    # 10 Central aisle treads (A to J)
    for r in "ABCDEFGHIJ":
        name = f"central_aisle_tread_{r}"
        if name in nodes:
            v = verts(j, b, nodes[name])
            box = to_gltf_box(v.min(0), v.max(0))
            walkable.append({
                "name": name,
                "type": "tread",
                "row": r,
                "bounds": box,
                "top_y": box["max"][1]
            })

    # 2. Colliders
    colliders = []

    # Walls
    for w in ["front_wall", "back_wall", "left_wall", "right_wall"]:
        if w in nodes:
            v = verts(j, b, nodes[w])
            colliders.append({
                "name": w,
                "type": "wall",
                "bounds": to_gltf_box(v.min(0), v.max(0))
            })

    # Screen frame & stage lip
    for s in ["screen_outer_frame", "screen_stage_lip"]:
        if s in nodes:
            v = verts(j, b, nodes[s])
            colliders.append({
                "name": s,
                "type": "screen_structure",
                "bounds": to_gltf_box(v.min(0), v.max(0))
            })

    # Speaker towers
    for spk in ["speaker_tower_L", "speaker_tower_R"]:
        if spk in nodes:
            v = verts(j, b, nodes[spk])
            colliders.append({
                "name": spk,
                "type": "speaker",
                "bounds": to_gltf_box(v.min(0), v.max(0))
            })

    # Rail posts
    for rp in sorted([n for n in nodes if n.startswith("rail_post_")]):
        v = verts(j, b, nodes[rp])
        colliders.append({
            "name": rp,
            "type": "rail_post",
            "bounds": to_gltf_box(v.min(0), v.max(0))
        })

    # 100 Seats
    seat_colliders = []
    for name in sorted(nodes.keys()):
        if not name.startswith("seat_"):
            continue
        v = verts(j, b, nodes[name])
        seat_colliders.append({
            "name": name,
            "type": "seat",
            "bounds": to_gltf_box(v.min(0), v.max(0))
        })

    colliders.extend(seat_colliders)

    out = {
        "version": 2,
        "generated_from": "cineverse_auditorium_v2.glb",
        "coordinate_system": "glTF Y-up, right-handed",
        "units": {
            "scene_unit": "model unit",
            "unit_to_meters_estimate": 0.43
        },
        "player": {
            "radius": 0.30,
            "standing_eye_height": 3.77,
            "crouch_eye_height": 2.50,
            "seated_eye_height": 1.90,
            "max_step_up": 0.30,
            "max_step_down": 0.40,
            "walk_speed": 3.0,
            "run_speed": 6.0,
            "spawn_position": [0.0, 0.0, -5.5],
            "spawn_yaw": 3.14159,  # facing -Z (toward seats)
            "fov": 70.0
        },
        "aisles": {
            "central": {"x_min": -0.56, "x_max": 0.56, "width": 1.12},
            "side_left": {"x_min": -10.69, "x_max": -6.64},
            "side_right": {"x_min": 6.64, "x_max": 10.69}
        },
        "walkable_count": len(walkable),
        "collider_count": len(colliders),
        "walkable": walkable,
        "colliders": colliders
    }

    output_path = "frontend/public/models/walk_nav_v2.json"
    with open(output_path, "w") as out_f:
        json.dump(out, out_f, indent=2)

    print(f"Generated {output_path}: {len(walkable)} walkable surfaces, {len(colliders)} colliders (including {len(seat_colliders)} seats).")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "frontend/public/models/cineverse_auditorium_v2.glb")

