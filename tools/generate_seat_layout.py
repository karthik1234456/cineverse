#!/usr/bin/env python3
"""Derive seat_layout_v2.json directly from the GLB (no Blender needed).

Coordinate handling (verified on cineverse_auditorium_v2.glb):
  Every mesh node carries matrix = Rx(+90deg): glTF = (x_v, z_v, -y_v).
  i.e. vertex data is Blender Z-up; after node matrices the scene is glTF Y-up,
  screen at z ~ -1.25, audience sits at more negative Z (A row z~-8 ... J row z~-21.5),
  so every seat FACES +Z. Facing +Z in a right-handed Y-up system, the viewer's right is -X.
Usage: python tools/generate_seat_layout.py frontend/public/models/cineverse_auditorium_v2.glb
"""
import json, math, struct, sys
import numpy as np

# ---- tunable assumptions (documented in the output JSON) ----
UNIT_TO_M = 0.43          # ESTIMATE: seat width 1.28 units ~ 0.55 m
CUSHION_TOP_ABOVE_SEAT_MIN = 0.80   # units; from vertex-height histogram (cushion top ~1.17 abs on tier 0.22)
EYE_ABOVE_CUSHION_M = 0.65          # seated adult, cushion -> eye
EYE_FORWARD_OF_BACK = 0.45          # units in front of backrest rear face
CATEGORIES = {  # demo defaults, INR
    "front":   {"label": "Front",   "rows": "ABC",  "price": 150, "color": "#c9a227"},
    "prime":   {"label": "Prime",   "rows": "DEFG", "price": 250, "color": "#4f8cff"},
    "premier": {"label": "Premier", "rows": "HIJ",  "price": 350, "color": "#b04fff"},
}

def load(path):
    f = open(path, "rb").read()
    clen = struct.unpack("<I", f[12:16])[0]
    j = json.loads(f[20:20 + clen]); b = f[20 + clen + 8:]
    return j, b

def verts(j, b, node):
    p = j["meshes"][node["mesh"]]["primitives"][0]
    a = j["accessors"][p["attributes"]["POSITION"]]; bv = j["bufferViews"][a["bufferView"]]
    return np.frombuffer(b, "<f4", a["count"] * 3, bv.get("byteOffset", 0) + a.get("byteOffset", 0)).reshape(-1, 3)

def to_gltf(v):  # Blender-style (x, y_depth, z_up) -> glTF Y-up
    return np.array([v[0], v[2], -v[1]])

def category_of(row):
    return next(k for k, c in CATEGORIES.items() if row in c["rows"])

def main(path):
    j, b = load(path)
    by = {n["name"]: n for n in j["nodes"]}
    sc = verts(j, b, by["cinema_screen_surface"]); smin, smax = sc.min(0), sc.max(0)
    screen_center = to_gltf((smin + smax) / 2)
    screen_w, screen_h = float(smax[0] - smin[0]), float(smax[2] - smin[2])
    allv = np.vstack([verts(j, b, n) for n in j["nodes"] if "mesh" in n and not n["name"].startswith("seat_")])
    seats = []
    for name, n in by.items():
        if not name.startswith("seat_"): continue
        _, row, num = name.split("_")
        node_num = int(num)
        seat_num = 11 - node_num  # Mirrored numbering: seat 01 on audience-left (+X), seat 10 on audience-right (-X)
        seat_id = f"{row}{seat_num:02d}"
        v = verts(j, b, n); mn, mx = v.min(0), v.max(0)
        center_g = to_gltf((mn + mx) / 2)
        cushion_top = mn[2] + CUSHION_TOP_ABOVE_SEAT_MIN
        eye = np.array([(mn[0] + mx[0]) / 2,
                        cushion_top + EYE_ABOVE_CUSHION_M / UNIT_TO_M,
                        -(mx[1] - EYE_FORWARD_OF_BACK)])
        d = screen_center - eye
        dist = float(np.linalg.norm(d))
        horiz = math.degrees(math.atan2(-d[0], d[2]))       # + = screen centre is to the viewer's right of straight ahead (viewer faces +Z, right = -X)
        vert = math.degrees(math.atan2(d[1], math.hypot(d[0], d[2])))  # + = look up
        zs = d[2]  # depth along the facing direction (+Z)
        h_fov = math.degrees(2 * math.atan((screen_w / 2) / zs))
        v_fov = math.degrees(2 * math.atan((screen_h / 2) / zs))
        cat = category_of(row)
        seats.append({
            "seat_id": seat_id, "node_name": name, "row": row, "number": seat_num,
            "category": cat, "price": CATEGORIES[cat]["price"],
            "position_gltf_y_up": [round(float(x), 3) for x in center_g],
            "bounds_gltf_y_up": {"min": [round(float(x), 3) for x in to_gltf(np.array([mn[0], mx[1], mn[2]]))],
                                 "max": [round(float(x), 3) for x in to_gltf(np.array([mx[0], mn[1], mx[2]]))]},
            "eye_position_gltf_y_up": [round(float(x), 3) for x in eye],
            "screen_distance": round(dist, 3), "screen_distance_m_est": round(dist * UNIT_TO_M, 2),
            "horizontal_offset_deg": round(horiz, 2), "vertical_angle_deg": round(vert, 2),
            "screen_h_fov_deg": round(h_fov, 1), "screen_v_fov_deg": round(v_fov, 1),
        })
    seats.sort(key=lambda s: (s["row"], s["number"]))
    out = {
        "version": 2, "generated_from": "cineverse_auditorium_v2.glb (derived, not measured)",
        "coordinate_system": "glTF Y-up, right-handed. Screen at z~-1.25; audience at more negative Z. Seats face +Z (toward the screen). Viewer's right is -X. Three.js camera: use lookAt(screen centre); do not assume the default -Z forward.",
        "units": {"scene_unit": "model unit", "unit_to_meters_estimate": UNIT_TO_M,
                  "note": "ESTIMATE from seat width (1.28u ~ 0.55m). Distances in m are approximate."},
        "auditorium": {"bounds_min": [round(float(x), 2) for x in allv.min(0)[[0, 2, 1]] * [1, 1, -1]],
                       "note": "Interior approx x[-11,11], y[0,11.06], z[-25.7,-0.3]"},
        "screen": {"center_gltf_y_up": [round(float(x), 3) for x in screen_center],
                   "width": round(screen_w, 3), "height": round(screen_h, 3), "aspect": round(screen_w / screen_h, 3),
                   "mesh": "cinema_screen_surface"},
        "eye_model": {"cushion_top_above_seat_min_units": CUSHION_TOP_ABOVE_SEAT_MIN,
                      "eye_above_cushion_m": EYE_ABOVE_CUSHION_M, "eye_forward_of_backrest_units": EYE_FORWARD_OF_BACK,
                      "disclaimer": "Geometric estimate for a seated adult. Not a measurement of a physical cinema. No obstruction (heads, rails) is modelled."},
        "categories": CATEGORIES, "seats": seats,
    }
    json.dump(out, open("frontend/public/models/seat_layout_v2.json", "w"), indent=2)
    print(f"wrote {len(seats)} seats; screen center {out['screen']['center_gltf_y_up']}")

main(sys.argv[1])
