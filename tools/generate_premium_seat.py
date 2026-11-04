import struct
import json
import math
import os

def create_beveled_box(x_min, y_min, z_min, x_max, y_max, z_max, segments_x=4, segments_y=4, segments_z=4):
    """Generates vertices, normals, and indices for a smooth rounded box."""
    vertices = []
    normals = []
    indices = []

    dx = x_max - x_min
    dy = y_max - y_min
    dz = z_max - z_min
    cx = (x_min + x_max) / 2
    cy = (y_min + y_max) / 2
    cz = (z_min + z_max) / 2

    # Generate 6 faces with subdivision and soft rounded displacement
    def add_face(u_steps, v_steps, get_pos_normal):
        start_idx = len(vertices) // 3
        for i in range(u_steps + 1):
            u = i / u_steps
            for j in range(v_steps + 1):
                v = j / v_steps
                pos, norm = get_pos_normal(u, v)
                vertices.extend(pos)
                normals.extend(norm)

        for i in range(u_steps):
            for j in range(v_steps):
                p0 = start_idx + i * (v_steps + 1) + j
                p1 = p0 + 1
                p2 = start_idx + (i + 1) * (v_steps + 1) + j
                p3 = p2 + 1
                indices.extend([p0, p2, p1, p1, p2, p3])

    # Front face (+Z)
    def front_face(u, v):
        x = x_min + u * dx
        y = y_min + v * dy
        # Slight rounded bulging
        bulge = math.sin(u * math.pi) * math.sin(v * math.pi) * 0.03
        z = z_max + bulge
        nx = (u - 0.5) * 0.4
        ny = (v - 0.5) * 0.4
        nz = 1.0
        length = math.sqrt(nx*nx + ny*ny + nz*nz)
        return [x, y, z], [nx/length, ny/length, nz/length]

    # Back face (-Z)
    def back_face(u, v):
        x = x_max - u * dx
        y = y_min + v * dy
        z = z_min
        return [x, y, z], [0.0, 0.0, -1.0]

    # Top face (+Y)
    def top_face(u, v):
        x = x_min + u * dx
        z = z_max - v * dz
        bulge = math.sin(u * math.pi) * math.sin(v * math.pi) * 0.02
        y = y_max + bulge
        nx = (u - 0.5) * 0.3
        ny = 1.0
        nz = (0.5 - v) * 0.3
        length = math.sqrt(nx*nx + ny*ny + nz*nz)
        return [x, y, z], [nx/length, ny/length, nz/length]

    # Bottom face (-Y)
    def bottom_face(u, v):
        x = x_min + u * dx
        z = z_min + v * dz
        y = y_min
        return [x, y, z], [0.0, -1.0, 0.0]

    # Right face (+X)
    def right_face(u, v):
        z = z_max - u * dz
        y = y_min + v * dy
        x = x_max
        return [x, y, z], [1.0, 0.0, 0.0]

    # Left face (-X)
    def left_face(u, v):
        z = z_min + u * dz
        y = y_min + v * dy
        x = x_min
        return [x, y, z], [-1.0, 0.0, 0.0]

    add_face(segments_x, segments_y, front_face)
    add_face(segments_x, segments_y, back_face)
    add_face(segments_x, segments_z, top_face)
    add_face(segments_x, segments_z, bottom_face)
    add_face(segments_z, segments_y, right_face)
    add_face(segments_z, segments_y, left_face)

    return vertices, normals, indices

def create_cup_holder(center_x, center_y, center_z, radius=0.045, depth=0.06, segments=12):
    """Generates vertices and indices for an embedded cup holder recess."""
    vertices = []
    normals = []
    indices = []
    
    rim_start = 0
    bottom_start = segments
    center_idx = segments * 2

    for i in range(segments):
        angle = (i / segments) * 2 * math.pi
        x = center_x + math.cos(angle) * radius
        z = center_z + math.sin(angle) * radius
        # Rim
        vertices.extend([x, center_y, z])
        normals.extend([0.0, 1.0, 0.0])
    
    for i in range(segments):
        angle = (i / segments) * 2 * math.pi
        x = center_x + math.cos(angle) * (radius * 0.85)
        z = center_z + math.sin(angle) * (radius * 0.85)
        # Inner bottom
        vertices.extend([x, center_y - depth, z])
        normals.extend([0.0, 1.0, 0.0])

    # Center bottom point
    vertices.extend([center_x, center_y - depth, center_z])
    normals.extend([0.0, 1.0, 0.0])

    # Side walls
    for i in range(segments):
        next_i = (i + 1) % segments
        r0 = i
        r1 = next_i
        b0 = bottom_start + i
        b1 = bottom_start + next_i
        indices.extend([r0, b0, r1, r1, b0, b1])

    # Bottom disc
    for i in range(segments):
        next_i = (i + 1) % segments
        indices.extend([center_idx, bottom_start + i, bottom_start + next_i])

    return vertices, normals, indices

def generate_premium_seat_glb(output_path):
    all_vertices = []
    all_normals = []
    all_indices = []

    def merge_mesh(v, n, idx):
        start_v = len(all_vertices) // 3
        all_vertices.extend(v)
        all_normals.extend(n)
        for i in idx:
            all_indices.append(start_v + i)

    # Total bounding footprint to match:
    # Width X: [-0.64, +0.64] (total width 1.28)
    # Height Y: [0.00, 1.99]
    # Depth Z: [-0.49, +0.49] (total depth 0.98)

    # 1. Backrest (High, ergonomic, contoured lumbar & headrest)
    # X: [-0.52, +0.52], Y: [0.72, 1.99], Z: [-0.46, -0.16]
    v_back, n_back, idx_back = create_beveled_box(-0.52, 0.72, -0.46, 0.52, 1.99, -0.16, 8, 10, 4)
    merge_mesh(v_back, n_back, idx_back)

    # 2. Seat Cushion (Plush, deep contour, slight tilt)
    # X: [-0.50, +0.50], Y: [0.44, 0.72], Z: [-0.38, 0.44]
    v_cushion, n_cushion, idx_cushion = create_beveled_box(-0.50, 0.44, -0.38, 0.50, 0.72, 0.44, 8, 4, 8)
    merge_mesh(v_cushion, n_cushion, idx_cushion)

    # 3. Left Armrest with Cup Holder
    # X: [0.50, 0.64], Y: [0.42, 0.86], Z: [-0.42, 0.42]
    v_arm_l, n_arm_l, idx_arm_l = create_beveled_box(0.50, 0.42, -0.42, 0.64, 0.86, 0.42, 3, 5, 6)
    merge_mesh(v_arm_l, n_arm_l, idx_arm_l)
    v_cup_l, n_cup_l, idx_cup_l = create_cup_holder(0.57, 0.86, 0.28, radius=0.045, depth=0.06)
    merge_mesh(v_cup_l, n_cup_l, idx_cup_l)

    # 4. Right Armrest with Cup Holder
    # X: [-0.64, -0.50], Y: [0.42, 0.86], Z: [-0.42, 0.42]
    v_arm_r, n_arm_r, idx_arm_r = create_beveled_box(-0.64, 0.42, -0.42, -0.50, 0.86, 0.42, 3, 5, 6)
    merge_mesh(v_arm_r, n_arm_r, idx_arm_r)
    v_cup_r, n_cup_r, idx_cup_r = create_cup_holder(-0.57, 0.86, 0.28, radius=0.045, depth=0.06)
    merge_mesh(v_cup_r, n_cup_r, idx_cup_r)

    # 5. Sturdy Pedestal Base & Floor Mount Plate
    # Base column: X: [-0.22, 0.22], Y: [0.06, 0.44], Z: [-0.24, 0.24]
    v_ped, n_ped, idx_ped = create_beveled_box(-0.22, 0.06, -0.24, 0.22, 0.44, 0.24, 4, 4, 4)
    merge_mesh(v_ped, n_ped, idx_ped)

    # Floor mounting plate: X: [-0.35, 0.35], Y: [0.00, 0.06], Z: [-0.35, 0.35]
    v_plate, n_plate, idx_plate = create_beveled_box(-0.35, 0.00, -0.35, 0.35, 0.06, 0.35, 4, 2, 4)
    merge_mesh(v_plate, n_plate, idx_plate)

    # Total counts
    num_vertices = len(all_vertices) // 3
    num_indices = len(all_indices)
    num_triangles = num_indices // 3
    print(f"Generated Premium Seat: {num_vertices} vertices, {num_triangles} triangles")

    # Min / Max bounds computation
    xs = all_vertices[0::3]
    ys = all_vertices[1::3]
    zs = all_vertices[2::3]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    min_z, max_z = min(zs), max(zs)
    print(f"Bounds X: [{min_x:.3f}, {max_x:.3f}], width: {max_x - min_x:.3f}")
    print(f"Bounds Y: [{min_y:.3f}, {max_y:.3f}], height: {max_y - min_y:.3f}")
    print(f"Bounds Z: [{min_z:.3f}, {max_z:.3f}], depth: {max_z - min_z:.3f}")

    # Pack binary buffers
    # 1. Position buffer (float32 * 3)
    pos_bytes = struct.pack(f'<{len(all_vertices)}f', *all_vertices)
    # 2. Normal buffer (float32 * 3)
    norm_bytes = struct.pack(f'<{len(all_normals)}f', *all_normals)
    # 3. Index buffer (uint32)
    idx_bytes = struct.pack(f'<{len(all_indices)}I', *all_indices)

    # Align each buffer to 4-byte boundary
    def pad4(b):
        pad = (4 - (len(b) % 4)) % 4
        return b + b'\x00' * pad

    pos_bytes = pad4(pos_bytes)
    norm_bytes = pad4(norm_bytes)
    idx_bytes = pad4(idx_bytes)

    bin_data = pos_bytes + norm_bytes + idx_bytes

    offset_pos = 0
    len_pos = len(all_vertices) * 4
    offset_norm = len(pos_bytes)
    len_norm = len(all_normals) * 4
    offset_idx = len(pos_bytes) + len(norm_bytes)
    len_idx = len(all_indices) * 4

    gltf_json = {
        "asset": {"version": "2.0", "generator": "CineVerse Premium Seat Generator"},
        "scenes": [{"nodes": [0]}],
        "nodes": [{"name": "PremiumCinemaSeat", "mesh": 0}],
        "meshes": [{
            "name": "PremiumCinemaSeat_Mesh",
            "primitives": [{
                "attributes": {
                    "POSITION": 0,
                    "NORMAL": 1
                },
                "indices": 2,
                "material": 0
            }]
        }],
        "materials": [{
            "name": "Seat_Velvet_PBR",
            "pbrMetallicRoughness": {
                "baseColorFactor": [0.47, 0.08, 0.11, 1.0],
                "metallicFactor": 0.05,
                "roughnessFactor": 0.72
            },
            "doubleSided": False
        }],
        "accessors": [
            {
                "bufferView": 0,
                "byteOffset": 0,
                "componentType": 5126, # FLOAT
                "count": num_vertices,
                "type": "VEC3",
                "max": [max_x, max_y, max_z],
                "min": [min_x, min_y, min_z]
            },
            {
                "bufferView": 1,
                "byteOffset": 0,
                "componentType": 5126, # FLOAT
                "count": num_vertices,
                "type": "VEC3",
                "max": [1.0, 1.0, 1.0],
                "min": [-1.0, -1.0, -1.0]
            },
            {
                "bufferView": 2,
                "byteOffset": 0,
                "componentType": 5125, # UNSIGNED_INT
                "count": num_indices,
                "type": "SCALAR",
                "max": [num_vertices - 1],
                "min": [0]
            }
        ],
        "bufferViews": [
            {
                "buffer": 0,
                "byteOffset": offset_pos,
                "byteLength": len_pos,
                "target": 34962 # ARRAY_BUFFER
            },
            {
                "buffer": 0,
                "byteOffset": offset_norm,
                "byteLength": len_norm,
                "target": 34962 # ARRAY_BUFFER
            },
            {
                "buffer": 0,
                "byteOffset": offset_idx,
                "byteLength": len_idx,
                "target": 34963 # ELEMENT_ARRAY_BUFFER
            }
        ],
        "buffers": [{
            "byteLength": len(bin_data)
        }]
    }

    json_str = json.dumps(gltf_json, separators=(',', ':'))
    # Pad JSON string with spaces to 4-byte alignment
    pad_len = (4 - (len(json_str) % 4)) % 4
    json_str += ' ' * pad_len
    json_bytes = json_str.encode('utf-8')

    total_len = 12 + 8 + len(json_bytes) + 8 + len(bin_data)

    header = struct.pack('<4sII', b'glTF', 2, total_len)
    chunk0_hdr = struct.pack('<II', len(json_bytes), 0x4E4F534A) # JSON
    chunk1_hdr = struct.pack('<II', len(bin_data), 0x004E4942)   # BIN

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'wb') as f:
        f.write(header)
        f.write(chunk0_hdr)
        f.write(json_bytes)
        f.write(chunk1_hdr)
        f.write(bin_data)

    print(f"Exported valid GLB to {output_path} ({os.path.getsize(output_path)} bytes)")

if __name__ == '__main__':
    target = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'models', 'seat_premium.glb')
    generate_premium_seat_glb(target)

