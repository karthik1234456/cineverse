import json

with open('frontend/public/models/seat_layout_v2.json') as f:
    d = json.load(f)

print('Screen center:', d['screen']['center_gltf_y_up'])
print('\nRow A:')
row_a = [s for s in d['seats'] if s['row'] == 'A']
for s in sorted(row_a, key=lambda x: x['number']):
    print(f"{s['seat_id']} ({s['node_name']}): pos_x={s['position_gltf_y_up'][0]}, horiz_deg={s['horizontal_offset_deg']}")

print('\nRow E:')
row_e = [s for s in d['seats'] if s['row'] == 'E']
for s in sorted(row_e, key=lambda x: x['number']):
    print(f"{s['seat_id']} ({s['node_name']}): pos_x={s['position_gltf_y_up'][0]}, horiz_deg={s['horizontal_offset_deg']}")

