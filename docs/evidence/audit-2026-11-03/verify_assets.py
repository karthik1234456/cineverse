import json
import hashlib
from pathlib import Path

def check():
    glb = Path("frontend/public/models/cineverse_auditorium_v2.glb")
    print(f"GLB exists: {glb.exists()}, size: {glb.stat().st_size} bytes")
    h = hashlib.sha256(glb.read_bytes()).hexdigest()
    print(f"GLB SHA256: {h}")

    with open("frontend/public/models/seat_layout_v2.json", "r", encoding="utf-8") as f:
        layout = json.load(f)
    seats = layout.get("seats", [])
    print(f"Total seats in seat_layout_v2.json: {len(seats)}")
    a05 = next((s for s in seats if s["seat_id"] == "A05"), None)
    a01 = next((s for s in seats if s["seat_id"] == "A01"), None)
    a10 = next((s for s in seats if s["seat_id"] == "A10"), None)
    print(f"A05: node={a05['node_name']}, eye={a05['eye_position_gltf_y_up']}")
    print(f"A01: node={a01['node_name']}, eye={a01['eye_position_gltf_y_up']}")
    print(f"A10: node={a10['node_name']}, eye={a10['eye_position_gltf_y_up']}")
    print(f"Audience left check: A01 X={a01['eye_position_gltf_y_up'][0]} vs A10 X={a10['eye_position_gltf_y_up'][0]}")

    with open("frontend/public/models/walk_nav_v2.json", "r", encoding="utf-8") as f:
        nav = json.load(f)
    print(f"Walk nav keys: {list(nav.keys())}")
    print(f"walkable: {len(nav.get('walkable', []))}, colliders: {len(nav.get('colliders', []))}")
    print(f"Player spawn: {nav.get('player', {}).get('spawn_position')}")

if __name__ == "__main__":
    check()
