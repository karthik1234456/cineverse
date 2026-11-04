for path in ['backend/tests/test_phase1.py', 'backend/tests/test_phase12_operations.py']:
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()

    # In test_phase1.py:
    c = c.replace(
        'layout_path = Path("frontend/public/models/seat_layout_v2.json")',
        'layout_path = Path(__file__).resolve().parent.parent.parent / "frontend/public/models/seat_layout_v2.json"'
    )
    # In test_phase12_operations.py:
    c = c.replace(
        'glb_path = "frontend/public/models/cineverse_auditorium_v2.glb"',
        'import os\n    glb_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../frontend/public/models/cineverse_auditorium_v2.glb")) if not os.path.exists("frontend/public/models/cineverse_auditorium_v2.glb") else "frontend/public/models/cineverse_auditorium_v2.glb"'
    )
    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)

print("Updated relative model filepaths to be CWD-independent")

