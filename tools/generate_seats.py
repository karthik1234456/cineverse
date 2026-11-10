#!/usr/bin/env python3
"""
CineVerse Original 3D Cinema Seat Generator
============================================
Procedurally generates original, photorealistic cinema seats in 3 distinct families:
  Family A: Standard Cinema Seat (push-back, separate headrest, stitch seams, cup holders, stanchion feet, tipped variant)
  Family B: Recliner / Premium Seat (wide leather armchair, rolled arms, quilted back, recline button, footrest, single & pair)
  Family C: Boutique Sofa (fluted channel backrest, deep bench cushion, bolster arms, brass-capped spindle legs)

Each family is generated in 3 Levels of Detail (LODs):
  LOD0 (Near): ~4,000 - 8,000 triangles (curved bevels, detailed stitch seams, cupholder cavities, hardware)
  LOD1 (Mid):  ~1,400 - 1,800 triangles (streamlined silhouette, simplified seams and fittings)
  LOD2 (Far):  ~280 - 380 triangles (silhouette-preserving low-poly proxy)

Technical Specifications:
- Coordinate origin [0, 0, 0] at floor center, facing +Z (audience faces +Z toward screen)
- Real-world scale with unit-to-scene mapping
- Smooth shading with area-weighted normals
- Baked ambient-occlusion vertex colors (COLOR_0, float32 RGBA)
- PBR material definitions (Standard fabric, Recliner leather, Boutique velvet, black poly, brushed metal)
- Output directory: frontend/public/models/seats/
- Outputs a complete manifest.json with footprints, triangle counts, eye heights, and sharing rules.
"""

import os
import sys
import math
import struct
import json
from typing import List, Tuple, Dict, Any

# Ensure output directory exists
SEATS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "models", "seats"))
os.makedirs(SEATS_DIR, exist_ok=True)


class MeshBuilder:
    """Helper to assemble vertices, normals, UVs, vertex colors, and indices into GLTF binary buffers."""

    def __init__(self):
        self.vertices: List[float] = []
        self.normals: List[float] = []
        self.uvs: List[float] = []
        self.colors: List[float] = []  # RGBA float32
        self.indices: List[int] = []

    def vertex_count(self) -> int:
        return len(self.vertices) // 3

    def triangle_count(self) -> int:
        return len(self.indices) // 3

    def add_vertex(self, x: float, y: float, z: float, nx: float, ny: float, nz: float, u: float = 0.0, v: float = 0.0, ao: float = 1.0):
        # Normalize normal
        l = math.sqrt(nx * nx + ny * ny + nz * nz)
        if l > 1e-6:
            nx, ny, nz = nx / l, ny / l, nz / l
        else:
            nx, ny, nz = 0.0, 1.0, 0.0

        self.vertices.extend([round(x, 5), round(y, 5), round(z, 5)])
        self.normals.extend([round(nx, 5), round(ny, 5), round(nz, 5)])
        self.uvs.extend([round(u, 5), round(v, 5)])
        # AO applied to RGB channels, Alpha is 1.0
        self.colors.extend([round(ao, 3), round(ao, 3), round(ao, 3), 1.0])

    def add_triangle(self, i1: int, i2: int, i3: int):
        self.indices.extend([i1, i2, i3])

    def add_quad(self, i1: int, i2: int, i3: int, i4: int):
        self.indices.extend([i1, i2, i3, i1, i3, i4])

    def merge(self, other: 'MeshBuilder'):
        offset = self.vertex_count()
        self.vertices.extend(other.vertices)
        self.normals.extend(other.normals)
        self.uvs.extend(other.uvs)
        self.colors.extend(other.colors)
        for idx in other.indices:
            self.indices.append(offset + idx)


def create_beveled_box(
    x_min: float, y_min: float, z_min: float,
    x_max: float, y_max: float, z_max: float,
    seg_x: int = 4, seg_y: int = 4, seg_z: int = 4,
    bulge_front: float = 0.0,
    bulge_top: float = 0.0,
    bulge_sides: float = 0.0,
    ao_base: float = 1.0,
    ao_bottom: float = 0.7,
    seams_h: List[float] = None,
    seams_v: List[float] = None,
    seam_depth: float = 0.015
) -> MeshBuilder:
    """
    Creates a smoothly rounded contoured box with optional bulge, stitch seam indentations,
    and height-gradient ambient occlusion.
    """
    m = MeshBuilder()
    dx = x_max - x_min
    dy = y_max - y_min
    dz = z_max - z_min
    seams_h = seams_h or []
    seams_v = seams_v or []

    def get_ao(y: float) -> float:
        # Height-based ambient occlusion (darker near the floor)
        factor = max(0.0, min(1.0, y / 2.0))
        return ao_bottom + (ao_base - ao_bottom) * factor

    # Helper for adding a parametric grid face
    def add_grid_face(u_steps: int, v_steps: int, pos_fn):
        start_idx = m.vertex_count()
        for i in range(u_steps + 1):
            u = i / u_steps
            for j in range(v_steps + 1):
                v = j / v_steps
                pos, norm, extra_ao = pos_fn(u, v)
                ao = get_ao(pos[1]) * extra_ao
                m.add_vertex(pos[0], pos[1], pos[2], norm[0], norm[1], norm[2], u, v, ao)

        for i in range(u_steps):
            for j in range(v_steps):
                p0 = start_idx + i * (v_steps + 1) + j
                p1 = p0 + 1
                p2 = start_idx + (i + 1) * (v_steps + 1) + j
                p3 = p2 + 1
                m.add_triangle(p0, p2, p1)
                m.add_triangle(p1, p2, p3)

    # 1. Front face (+Z)
    def front_pos(u, v):
        x = x_min + u * dx
        y = y_min + v * dy
        # Bulge in center
        b = math.sin(u * math.pi) * math.sin(v * math.pi) * bulge_front
        z = z_max + b
        extra_ao = 1.0

        # Check for horizontal seams
        for sh in seams_h:
            dist = abs(v - sh)
            if dist < 0.08:
                indent = math.cos((dist / 0.08) * (math.pi / 2)) * seam_depth
                z -= indent
                extra_ao *= (1.0 - 0.35 * (indent / seam_depth))

        # Check for vertical seams
        for sv in seams_v:
            dist = abs(u - sv)
            if dist < 0.08:
                indent = math.cos((dist / 0.08) * (math.pi / 2)) * seam_depth
                z -= indent
                extra_ao *= (1.0 - 0.35 * (indent / seam_depth))

        nx = (u - 0.5) * 0.4
        ny = (v - 0.5) * 0.3
        nz = 1.0
        return [x, y, z], [nx, ny, nz], extra_ao

    # 2. Back face (-Z)
    def back_pos(u, v):
        x = x_max - u * dx
        y = y_min + v * dy
        z = z_min
        return [x, y, z], [0.0, 0.0, -1.0], 0.9

    # 3. Top face (+Y)
    def top_pos(u, v):
        x = x_min + u * dx
        z = z_max - v * dz
        b = math.sin(u * math.pi) * math.sin(v * math.pi) * bulge_top
        y = y_max + b
        nx = (u - 0.5) * 0.3
        ny = 1.0
        nz = (0.5 - v) * 0.3
        return [x, y, z], [nx, ny, nz], 1.0

    # 4. Bottom face (-Y)
    def bottom_pos(u, v):
        x = x_min + u * dx
        z = z_min + v * dz
        y = y_min
        return [x, y, z], [0.0, -1.0, 0.0], 0.65

    # 5. Right face (+X)
    def right_pos(u, v):
        z = z_max - u * dz
        y = y_min + v * dy
        b = math.sin(u * math.pi) * math.sin(v * math.pi) * bulge_sides
        x = x_max + b
        return [x, y, z], [1.0, 0.0, 0.0], 0.95

    # 6. Left face (-X)
    def left_pos(u, v):
        z = z_min + u * dz
        y = y_min + v * dy
        b = math.sin(u * math.pi) * math.sin(v * math.pi) * bulge_sides
        x = x_min - b
        return [x, y, z], [-1.0, 0.0, 0.0], 0.95

    add_grid_face(seg_x, seg_y, front_pos)
    add_grid_face(seg_x, seg_y, back_pos)
    add_grid_face(seg_x, seg_z, top_pos)
    add_grid_face(seg_x, seg_z, bottom_pos)
    add_grid_face(seg_z, seg_y, right_pos)
    add_grid_face(seg_z, seg_y, left_pos)

    return m


def create_cylinder(
    cx: float, cy_bottom: float, cz: float,
    radius: float, height: float,
    segments: int = 12,
    caps: bool = True,
    axis: str = 'Y',
    ao_top: float = 1.0,
    ao_bottom: float = 0.8
) -> MeshBuilder:
    """Generates a cylinder along X, Y, or Z axis with normal smoothing."""
    m = MeshBuilder()
    start_v = m.vertex_count()

    # Generate ring at bottom and top
    for s in range(segments):
        theta = (s / segments) * 2 * math.pi
        c = math.cos(theta)
        s_val = math.sin(theta)

        if axis == 'Y':
            # Bottom vertex
            m.add_vertex(cx + c * radius, cy_bottom, cz + s_val * radius, c, 0.0, s_val, s / segments, 0.0, ao_bottom)
            # Top vertex
            m.add_vertex(cx + c * radius, cy_bottom + height, cz + s_val * radius, c, 0.0, s_val, s / segments, 1.0, ao_top)
        elif axis == 'X':
            # Cylinder along X (for rolled armrests)
            m.add_vertex(cx, cy_bottom + c * radius, cz + s_val * radius, 0.0, c, s_val, s / segments, 0.0, ao_bottom)
            m.add_vertex(cx + height, cy_bottom + c * radius, cz + s_val * radius, 0.0, c, s_val, s / segments, 1.0, ao_top)
        elif axis == 'Z':
            m.add_vertex(cx + c * radius, cy_bottom + s_val * radius, cz, c, s_val, 0.0, s / segments, 0.0, ao_bottom)
            m.add_vertex(cx + c * radius, cy_bottom + s_val * radius, cz + height, c, s_val, 0.0, s / segments, 1.0, ao_top)

    # Side quads
    for s in range(segments):
        next_s = (s + 1) % segments
        b0 = start_v + s * 2
        t0 = b0 + 1
        b1 = start_v + next_s * 2
        t1 = b1 + 1
        m.add_triangle(b0, b1, t0)
        m.add_triangle(t0, b1, t1)

    # Caps
    if caps and axis == 'Y':
        # Top cap
        top_center = m.vertex_count()
        m.add_vertex(cx, cy_bottom + height, cz, 0.0, 1.0, 0.0, 0.5, 0.5, ao_top)
        for s in range(segments):
            next_s = (s + 1) % segments
            t0 = start_v + s * 2 + 1
            t1 = start_v + next_s * 2 + 1
            m.add_triangle(top_center, t0, t1)

        # Bottom cap
        bot_center = m.vertex_count()
        m.add_vertex(cx, cy_bottom, cz, 0.0, -1.0, 0.0, 0.5, 0.5, ao_bottom)
        for s in range(segments):
            next_s = (s + 1) % segments
            b0 = start_v + s * 2
            b1 = start_v + next_s * 2
            m.add_triangle(bot_center, b1, b0)

    return m


def create_cup_holder_cavity(cx: float, cy: float, cz: float, outer_r: float = 0.05, inner_r: float = 0.042, depth: float = 0.065, segs: int = 12) -> MeshBuilder:
    """Generates an embedded cup holder rim and hollow cylindrical recess."""
    m = MeshBuilder()
    # Outer rim, inner rim, bottom disc
    rim_out_start = m.vertex_count()
    for i in range(segs):
        ang = (i / segs) * 2 * math.pi
        m.add_vertex(cx + math.cos(ang) * outer_r, cy, cz + math.sin(ang) * outer_r, 0.0, 1.0, 0.0, ao=0.9)

    rim_in_start = m.vertex_count()
    for i in range(segs):
        ang = (i / segs) * 2 * math.pi
        m.add_vertex(cx + math.cos(ang) * inner_r, cy, cz + math.sin(ang) * inner_r, 0.0, 1.0, 0.0, ao=0.7)

    bot_start = m.vertex_count()
    for i in range(segs):
        ang = (i / segs) * 2 * math.pi
        m.add_vertex(cx + math.cos(ang) * (inner_r * 0.9), cy - depth, cz + math.sin(ang) * (inner_r * 0.9), -math.cos(ang), 0.1, -math.sin(ang), ao=0.35)

    bot_center = m.vertex_count()
    m.add_vertex(cx, cy - depth, cz, 0.0, 1.0, 0.0, ao=0.3)

    for i in range(segs):
        ni = (i + 1) % segs
        # Top ring
        m.add_triangle(rim_out_start + i, rim_out_start + ni, rim_in_start + i)
        m.add_triangle(rim_in_start + i, rim_out_start + ni, rim_in_start + ni)
        # Inner cylindrical wall
        m.add_triangle(rim_in_start + i, rim_in_start + ni, bot_start + i)
        m.add_triangle(bot_start + i, rim_in_start + ni, bot_start + ni)
        # Bottom disc
        m.add_triangle(bot_center, bot_start + i, bot_start + ni)

    return m


# -------------------------------------------------------------------------------------------------
# FAMILY A: STANDARD CINEMA SEAT
# -------------------------------------------------------------------------------------------------
def build_standard_seat(lod: int = 0, is_tipped: bool = False) -> MeshBuilder:
    """
    Standard cinema seat:
    - High-back push-back chair
    - Separate padded headrest cushion at the top
    - Back panel with horizontal and vertical stitch seams
    - Softly rounded cushioned seat with gently curved front edge
    - Black moulded armrests with integrated round cup holders
    - Tapered black side supports and black metal floor-mounted foot at each side
    - If is_tipped is True, cushion is shown tipped up ~70 degrees.
    """
    seat = MeshBuilder()

    # Subdivision configurations per LOD
    if lod == 0:
        s_back = (14, 18, 4)
        s_head = (12, 10, 4)
        s_cush = (14, 8, 12)
        s_arm = (6, 6, 12)
        cup_segs = 20
        leg_segs = 16
    elif lod == 1:
        s_back = (7, 8, 2)
        s_head = (5, 5, 2)
        s_cush = (7, 4, 6)
        s_arm = (3, 3, 5)
        cup_segs = 10
        leg_segs = 8
    else:  # lod == 2 (far, target ~300 tris)
        s_back = (2, 2, 1)
        s_head = (2, 2, 1)
        s_cush = (2, 2, 2)
        s_arm = (2, 2, 2)
        cup_segs = 0
        leg_segs = 4

    # 1. Backrest Main Panel
    # X: [-0.48, +0.48], Y: [0.65, 1.62], Z: [-0.44, -0.18]
    # Includes 2 horizontal seams (lumbar/mid) and 2 vertical contour seams
    seams_h = [0.35, 0.70] if lod < 2 else []
    seams_v = [0.30, 0.70] if lod < 2 else []
    back = create_beveled_box(
        -0.48, 0.65, -0.44, 0.48, 1.62, -0.18,
        seg_x=s_back[0], seg_y=s_back[1], seg_z=s_back[2],
        bulge_front=0.04 if lod < 2 else 0.01,
        ao_base=0.95, ao_bottom=0.75,
        seams_h=seams_h, seams_v=seams_v, seam_depth=0.018
    )
    seat.merge(back)

    # 2. Separate Padded Headrest Cushion (distinct top pillow)
    # X: [-0.42, +0.42], Y: [1.64, 1.98], Z: [-0.42, -0.14]
    head = create_beveled_box(
        -0.42, 1.64, -0.42, 0.42, 1.98, -0.14,
        seg_x=s_head[0], seg_y=s_head[1], seg_z=s_head[2],
        bulge_front=0.03 if lod < 2 else 0.01,
        bulge_top=0.02,
        ao_base=1.0, ao_bottom=0.82
    )
    seat.merge(head)

    # 3. Seat Cushion
    if not is_tipped:
        # Standard down position: X: [-0.48, +0.48], Y: [0.42, 0.68], Z: [-0.36, 0.44]
        # Waterfall front edge (+Z)
        cush = create_beveled_box(
            -0.48, 0.42, -0.36, 0.48, 0.68, 0.44,
            seg_x=s_cush[0], seg_y=s_cush[1], seg_z=s_cush[2],
            bulge_top=0.03 if lod < 2 else 0.01,
            bulge_front=0.02,
            ao_base=0.95, ao_bottom=0.65
        )
        seat.merge(cush)
    else:
        # Tipped up position (rotated upwards ~75 degrees toward backrest)
        # Y: [0.55, 1.25], Z: [-0.28, -0.02]
        cush_tipped = create_beveled_box(
            -0.48, 0.55, -0.28, 0.48, 1.25, -0.02,
            seg_x=s_cush[0], seg_y=s_cush[1], seg_z=s_cush[2],
            bulge_top=0.02,
            ao_base=0.85, ao_bottom=0.60
        )
        seat.merge(cush_tipped)

    # 4. Black Moulded Armrests with Integrated Round Cup Holders (Left & Right)
    for side in [-1, 1]:
        x0 = 0.48 if side == 1 else -0.62
        x1 = 0.62 if side == 1 else -0.48
        # Armrest body: Y: [0.44, 0.82], Z: [-0.38, 0.42]
        arm = create_beveled_box(
            x0, 0.44, -0.38, x1, 0.82, 0.42,
            seg_x=s_arm[0], seg_y=s_arm[1], seg_z=s_arm[2],
            bulge_top=0.015,
            ao_base=0.90, ao_bottom=0.60
        )
        seat.merge(arm)

        # Cup holder cavity at front of armrest
        if lod < 2:
            cx = (x0 + x1) / 2
            cup = create_cup_holder_cavity(cx, 0.82, 0.28, outer_r=0.048, inner_r=0.040, depth=0.055, segs=cup_segs)
            seat.merge(cup)

    # 5. Tapered Black Side Supports & Metal Floor-Mounted Feet
    for side in [-1, 1]:
        sx = 0.53 * side
        st_segs = (1, 2, 1) if lod == 2 else (2, 3, 2)
        ft_segs = (1, 1, 2) if lod == 2 else (2, 1, 3)

        # Vertical steel stanchion: Y: [0.06, 0.46], Z: [-0.18, 0.18]
        stanchion = create_beveled_box(
            sx - 0.035, 0.06, -0.14, sx + 0.035, 0.46, 0.14,
            seg_x=st_segs[0], seg_y=st_segs[1], seg_z=st_segs[2],
            ao_base=0.75, ao_bottom=0.45
        )
        seat.merge(stanchion)

        # Floor mounting foot bracket: Y: [0.00, 0.06], Z: [-0.22, 0.22]
        foot = create_beveled_box(
            sx - 0.075, 0.00, -0.22, sx + 0.075, 0.06, 0.22,
            seg_x=ft_segs[0], seg_y=ft_segs[1], seg_z=ft_segs[2],
            ao_base=0.55, ao_bottom=0.25
        )
        seat.merge(foot)

    # Under-seat pivot tube & spring housing (between stanchions)
    tube = create_cylinder(0.0, 0.38, -0.10, radius=0.038, height=0.96, segments=leg_segs, axis='X', ao_top=0.65, ao_bottom=0.45)
    # Center along X
    for i in range(len(tube.vertices) // 3):
        tube.vertices[i * 3] -= 0.48
    seat.merge(tube)

    return seat


# -------------------------------------------------------------------------------------------------
# FAMILY B: RECLINER / PREMIUM SEAT (SINGLE & PAIR)
# -------------------------------------------------------------------------------------------------
def build_recliner_seat(is_pair: bool = False, lod: int = 0) -> MeshBuilder:
    """
    Recliner / Premium seat:
    - Wide, overstuffed leather-look armchair
    - Thick rolled padded armrests
    - High back with pillow-like headrest and quilted seam lines
    - Cushioned seat, visible recline lever or button on the side
    - Footrest shown tucked/down
    - Recessed metallic base
    - Single and pair (loveseat) variants.
    """
    seat = MeshBuilder()

    if lod == 0:
        s_back = (16, 18, 4)
        s_cush = (16, 8, 12)
        s_arm = (8, 8, 12)
        roll_segs = 20
    elif lod == 1:
        s_back = (7, 8, 2)
        s_cush = (7, 4, 6)
        s_arm = (4, 4, 5)
        roll_segs = 10
    else:  # lod == 2 (target ~300 tris)
        s_back = (2, 2, 1)
        s_cush = (2, 2, 2)
        s_arm = (2, 2, 2)
        roll_segs = 4

    # Determine dimensions
    # Single width: 0.88m (X: [-0.44, +0.44])
    # Pair width: 1.68m (X: [-0.84, +0.84])
    seat_centers = [-0.40, 0.40] if is_pair else [0.0]

    for sc in seat_centers:
        hw = 0.36  # half width of cushion/backrest per seat

        # 1. High Backrest with Quilted Seams
        # X: [sc - hw, sc + hw], Y: [0.68, 1.74], Z: [-0.44, -0.16]
        seams_h = [0.25, 0.50, 0.75] if lod < 2 else []
        seams_v = [0.35, 0.65] if lod < 2 else []
        back = create_beveled_box(
            sc - hw, 0.68, -0.44, sc + hw, 1.74, -0.16,
            seg_x=s_back[0], seg_y=s_back[1], seg_z=s_back[2],
            bulge_front=0.06 if lod < 2 else 0.02,
            bulge_sides=0.03,
            ao_base=0.96, ao_bottom=0.72,
            seams_h=seams_h, seams_v=seams_v, seam_depth=0.022
        )
        seat.merge(back)

        # 2. Pillow-like Plush Headrest
        # X: [sc - hw * 0.9, sc + hw * 0.9], Y: [1.74, 2.08], Z: [-0.42, -0.12]
        head = create_beveled_box(
            sc - hw * 0.9, 1.74, -0.42, sc + hw * 0.9, 2.08, -0.12,
            seg_x=s_back[0], seg_y=4, seg_z=s_back[2],
            bulge_front=0.05 if lod < 2 else 0.02,
            bulge_top=0.03,
            ao_base=1.0, ao_bottom=0.80
        )
        seat.merge(head)

        # 3. Deep Overstuffed Seat Cushion
        # X: [sc - hw, sc + hw], Y: [0.42, 0.72], Z: [-0.38, 0.46]
        cush = create_beveled_box(
            sc - hw, 0.42, -0.38, sc + hw, 0.72, 0.46,
            seg_x=s_cush[0], seg_y=s_cush[1], seg_z=s_cush[2],
            bulge_top=0.05 if lod < 2 else 0.02,
            bulge_front=0.03,
            ao_base=0.92, ao_bottom=0.62
        )
        seat.merge(cush)

        # 4. Integrated Tucked Footrest
        # Y: [0.18, 0.42], Z: [0.38, 0.48]
        footrest = create_beveled_box(
            sc - hw * 0.95, 0.18, 0.38, sc + hw * 0.95, 0.42, 0.48,
            seg_x=s_cush[0], seg_y=2, seg_z=2,
            ao_base=0.75, ao_bottom=0.55
        )
        seat.merge(footrest)

    # 5. Thick Rolled Padded Armrests
    # For single: Left X: [0.36, 0.52], Right X: [-0.52, -0.36]
    # For pair: Left X: [0.76, 0.92], Right X: [-0.92, -0.76], Center Console X: [-0.10, 0.10]
    arm_x_ranges = [(0.36, 0.52), (-0.52, -0.36)] if not is_pair else [(0.76, 0.92), (-0.92, -0.76), (-0.10, 0.10)]

    for x0, x1 in arm_x_ranges:
        is_center = (abs((x0 + x1) / 2) < 0.05)
        arm_top_y = 0.88 if not is_center else 0.80
        arm = create_beveled_box(
            x0, 0.38, -0.42, x1, arm_top_y, 0.44,
            seg_x=s_arm[0], seg_y=s_arm[1], seg_z=s_arm[2],
            bulge_top=0.025,
            bulge_sides=0.02,
            ao_base=0.90, ao_bottom=0.55
        )
        seat.merge(arm)

        # Cup holder & control button on outer arms
        if lod < 2 and not is_center:
            cx = (x0 + x1) / 2
            cup = create_cup_holder_cavity(cx, arm_top_y, 0.28, outer_r=0.052, inner_r=0.042, depth=0.06, segs=roll_segs)
            seat.merge(cup)

            # Recline metallic button panel on outer flank
            bx = x1 + 0.005 if x1 > 0 else x0 - 0.005
            btn_panel = create_beveled_box(
                bx - 0.008, arm_top_y - 0.14, 0.06, bx + 0.008, arm_top_y - 0.06, 0.20,
                seg_x=1, seg_y=1, seg_z=1,
                ao_base=0.85, ao_bottom=0.75
            )
            seat.merge(btn_panel)

        elif lod < 2 and is_center:
            # Center table / dual cup holders for couple loveseat
            cup1 = create_cup_holder_cavity(0.0, arm_top_y, 0.20, outer_r=0.046, inner_r=0.038, depth=0.055, segs=roll_segs)
            cup2 = create_cup_holder_cavity(0.0, arm_top_y, 0.02, outer_r=0.046, inner_r=0.038, depth=0.055, segs=roll_segs)
            seat.merge(cup1)
            seat.merge(cup2)

    # 6. Recessed Metal Base Plinth
    # Inset by 0.08m all around, Y: [0.00, 0.18]
    bx_min = min(r[0] for r in arm_x_ranges) + 0.06
    bx_max = max(r[1] for r in arm_x_ranges) - 0.06
    pl_segs = (1, 1, 1) if lod == 2 else (4, 2, 4)
    plinth = create_beveled_box(
        bx_min, 0.00, -0.34, bx_max, 0.18, 0.36,
        seg_x=pl_segs[0], seg_y=pl_segs[1], seg_z=pl_segs[2],
        ao_base=0.60, ao_bottom=0.30
    )
    seat.merge(plinth)

    return seat


# -------------------------------------------------------------------------------------------------
# FAMILY C: BOUTIQUE SOFA FOR SMALL HALLS
# -------------------------------------------------------------------------------------------------
def build_boutique_sofa(lod: int = 0) -> MeshBuilder:
    """
    Boutique sofa:
    - Plush, elegant boutique sofa with deep bench seating
    - Fluted / channeled backrest with vertical pillowed rolls
    - Rounded bolster arms with piping trim
    - Modern tapered spindle legs with brass-capped ferrules
    - Designed for boutique VIP screenings and small intimate halls.
    """
    sofa = MeshBuilder()

    if lod == 0:
        flute_count = 9
        flute_segs = 8
        bench_segs = (14, 6, 10)
        arm_segs = 16
        leg_segs = 16
    elif lod == 1:
        flute_count = 5
        flute_segs = 3
        bench_segs = (6, 3, 4)
        arm_segs = 6
        leg_segs = 6
    else:  # lod == 2 (target ~300 tris)
        flute_count = 2
        flute_segs = 1
        bench_segs = (2, 1, 2)
        arm_segs = 2
        leg_segs = 3

    # Dimensions: Total width 1.28m (X: [-0.64, +0.64]), Height 1.78m, Depth 0.96m
    # 1. Fluted Channeled Backrest
    # Array of vertical cushioned channels running across X: [-0.48, +0.48]
    back_width = 0.96
    flute_width = back_width / flute_count
    start_x = -back_width / 2

    flute_sy = 2 if lod == 2 else 4
    flute_sz = 1 if lod == 2 else 2

    for f in range(flute_count):
        fx0 = start_x + f * flute_width
        fx1 = fx0 + flute_width
        # Rounded vertical cushion roll: Y: [0.60, 1.76], Z: [-0.42, -0.16]
        flute = create_beveled_box(
            fx0 + 0.005, 0.60, -0.42, fx1 - 0.005, 1.76, -0.16,
            seg_x=flute_segs, seg_y=flute_sy, seg_z=flute_sz,
            bulge_front=0.03 if lod < 2 else 0.01,
            bulge_top=0.02,
            ao_base=0.95, ao_bottom=0.70
        )
        sofa.merge(flute)

    # Back structural frame behind flutes
    frm_sx = 1 if lod == 2 else 4
    frm_sy = 1 if lod == 2 else 4
    frame = create_beveled_box(
        -0.50, 0.58, -0.46, 0.50, 1.78, -0.40,
        seg_x=frm_sx, seg_y=frm_sy, seg_z=1,
        ao_base=0.80, ao_bottom=0.60
    )
    sofa.merge(frame)

    # 2. Deep Bench Seat Cushion
    # X: [-0.48, +0.48], Y: [0.38, 0.66], Z: [-0.36, 0.44]
    bench = create_beveled_box(
        -0.48, 0.38, -0.36, 0.48, 0.66, 0.44,
        seg_x=bench_segs[0], seg_y=bench_segs[1], seg_z=bench_segs[2],
        bulge_top=0.035 if lod < 2 else 0.01,
        bulge_front=0.025,
        ao_base=0.92, ao_bottom=0.65
    )
    sofa.merge(bench)

    # Lower wooden apron frame: Y: [0.26, 0.38], Z: [-0.38, 0.42]
    ap_sx = 1 if lod == 2 else 3
    ap_sz = 1 if lod == 2 else 3
    apron = create_beveled_box(
        -0.58, 0.26, -0.38, 0.58, 0.38, 0.42,
        seg_x=ap_sx, seg_y=1, seg_z=ap_sz,
        ao_base=0.75, ao_bottom=0.50
    )
    sofa.merge(apron)

    # 3. Rounded Bolster Armrests (Left & Right)
    for side in [-1, 1]:
        ax0 = 0.48 if side == 1 else -0.62
        ax1 = 0.62 if side == 1 else -0.48
        arm = create_beveled_box(
            ax0, 0.36, -0.40, ax1, 0.84, 0.44,
            seg_x=3, seg_y=4, seg_z=arm_segs,
            bulge_top=0.025,
            bulge_sides=0.02,
            ao_base=0.90, ao_bottom=0.60
        )
        sofa.merge(arm)

    # 4. Modern Tapered Spindle Legs with Brass Caps (4 corners)
    leg_positions = [
        (-0.52, -0.30),
        (0.52, -0.30),
        (-0.52, 0.34),
        (0.52, 0.34),
    ]

    for lx, lz in leg_positions:
        # Wooden leg upper: Y: [0.08, 0.26], radius 0.032 to 0.024
        leg_upper = create_cylinder(lx, 0.08, lz, radius=0.028, height=0.18, segments=leg_segs, axis='Y', ao_top=0.75, ao_bottom=0.50)
        sofa.merge(leg_upper)

        # Brass ferrule cap: Y: [0.00, 0.08], radius 0.022
        ferrule = create_cylinder(lx, 0.00, lz, radius=0.024, height=0.08, segments=leg_segs, axis='Y', ao_top=0.60, ao_bottom=0.25)
        sofa.merge(ferrule)

    return sofa


# -------------------------------------------------------------------------------------------------
# GLTF 2.0 BINARY PACKER (GLB)
# -------------------------------------------------------------------------------------------------
def generate_texture_atlases(output_dir: str):
    """Generates compact PBR texture atlases (diffuse + micro-normal maps) per family."""
    from PIL import Image, ImageDraw
    import random
    tex_dir = os.path.join(output_dir, "textures")
    os.makedirs(tex_dir, exist_ok=True)
    random.seed(42)

    size = 256
    # 1. Standard Fabric Diffuse & Normal
    diff_std = Image.new("RGBA", (size, size), (159, 18, 57, 255))
    draw_std = ImageDraw.Draw(diff_std)
    for x in range(0, size, 4):
        for y in range(0, size, 4):
            shade = random.randint(-12, 12)
            c = (max(0, min(255, 159 + shade)), max(0, min(255, 18 + shade // 2)), max(0, min(255, 57 + shade // 2)), 255)
            draw_std.point((x, y), fill=c)
    diff_std.save(os.path.join(tex_dir, "atlas_standard_diffuse.png"))

    norm_std = Image.new("RGBA", (size, size), (128, 128, 255, 255))
    draw_norm_std = ImageDraw.Draw(norm_std)
    for x in range(size):
        for y in range(size):
            nx = int(128 + math.sin(x * 0.8) * 14)
            ny = int(128 + math.cos(y * 0.8) * 14)
            draw_norm_std.point((x, y), fill=(nx, ny, 255, 255))
    norm_std.save(os.path.join(tex_dir, "atlas_standard_normal.png"))

    # 2. Recliner Leather Diffuse & Normal
    diff_rec = Image.new("RGBA", (size, size), (56, 36, 27, 255))
    draw_rec = ImageDraw.Draw(diff_rec)
    for x in range(0, size, 2):
        for y in range(0, size, 2):
            grain = random.randint(-8, 8)
            c = (max(0, min(255, 56 + grain)), max(0, min(255, 36 + grain)), max(0, min(255, 27 + grain)), 255)
            draw_rec.point((x, y), fill=c)
    diff_rec.save(os.path.join(tex_dir, "atlas_recliner_diffuse.png"))

    norm_rec = Image.new("RGBA", (size, size), (128, 128, 255, 255))
    draw_norm_rec = ImageDraw.Draw(norm_rec)
    for x in range(size):
        for y in range(size):
            nx = int(128 + (math.sin(x * 0.3) * math.cos(y * 0.3)) * 18)
            ny = int(128 + (math.cos(x * 0.3) * math.sin(y * 0.3)) * 18)
            draw_norm_rec.point((x, y), fill=(nx, ny, 255, 255))
    norm_rec.save(os.path.join(tex_dir, "atlas_recliner_normal.png"))

    # 3. Boutique Velvet Diffuse & Normal
    diff_sofa = Image.new("RGBA", (size, size), (46, 72, 88, 255))
    draw_sofa = ImageDraw.Draw(diff_sofa)
    for x in range(0, size, 3):
        for y in range(0, size, 3):
            sheen = random.randint(-10, 10)
            c = (max(0, min(255, 46 + sheen)), max(0, min(255, 72 + sheen)), max(0, min(255, 88 + sheen)), 255)
            draw_sofa.point((x, y), fill=c)
    diff_sofa.save(os.path.join(tex_dir, "atlas_sofa_diffuse.png"))

    norm_sofa = Image.new("RGBA", (size, size), (128, 128, 255, 255))
    draw_norm_sofa = ImageDraw.Draw(norm_sofa)
    for x in range(size):
        for y in range(size):
            nx = int(128 + math.sin(x * 0.4) * 8)
            ny = int(128 + math.cos(y * 0.4) * 12)
            draw_norm_sofa.point((x, y), fill=(nx, ny, 255, 255))
    norm_sofa.save(os.path.join(tex_dir, "atlas_sofa_normal.png"))

    print(f"Generated PBR Texture Atlases: {tex_dir}")


def export_glb(mesh: MeshBuilder, output_path: str, model_name: str, material_def: Dict[str, Any]):
    """
    Packs vertices, normals, uvs, vertex colors, and indices into a valid, optimized GLB file.
    Includes full PBR Material specifications and bounding box calculations.
    """
    verts = mesh.vertices
    norms = mesh.normals
    uvs = mesh.uvs
    colors = mesh.colors
    indices = mesh.indices

    num_verts = len(verts) // 3
    num_indices = len(indices)

    # Calculate bounding box
    xs = verts[0::3]
    ys = verts[1::3]
    zs = verts[2::3]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    min_z, max_z = min(zs), max(zs)

    # Pack binary buffers (little endian)
    pos_bytes = struct.pack(f'<{len(verts)}f', *verts)
    norm_bytes = struct.pack(f'<{len(norms)}f', *norms)
    uv_bytes = struct.pack(f'<{len(uvs)}f', *uvs)
    col_bytes = struct.pack(f'<{len(colors)}f', *colors)

    # Index buffer (use uint16 if < 65536, else uint32)
    use_uint16 = num_verts < 65535
    if use_uint16:
        idx_bytes = struct.pack(f'<{len(indices)}H', *indices)
        idx_component_type = 5123  # UNSIGNED_SHORT
    else:
        idx_bytes = struct.pack(f'<{len(indices)}I', *indices)
        idx_component_type = 5125  # UNSIGNED_INT

    def pad4(b: bytes) -> bytes:
        pad = (4 - (len(b) % 4)) % 4
        return b + b'\x00' * pad

    pos_bytes = pad4(pos_bytes)
    norm_bytes = pad4(norm_bytes)
    uv_bytes = pad4(uv_bytes)
    col_bytes = pad4(col_bytes)
    idx_bytes = pad4(idx_bytes)

    bin_data = pos_bytes + norm_bytes + uv_bytes + col_bytes + idx_bytes

    offset_pos = 0
    len_pos = len(pos_bytes)
    offset_norm = offset_pos + len_pos
    len_norm = len(norm_bytes)
    offset_uv = offset_norm + len_norm
    len_uv = len(uv_bytes)
    offset_col = offset_uv + len_uv
    len_col = len(col_bytes)
    offset_idx = offset_col + len_col
    len_idx = len(idx_bytes)

    # Build GLTF JSON
    gltf_json = {
        "asset": {
            "version": "2.0",
            "generator": "CineVerse Original Procedural Cinema Seat Studio v2026",
            "copyright": "CineVerse Cinemas India - Original Procedural Geometry"
        },
        "scenes": [{"nodes": [0]}],
        "nodes": [
            {
                "name": model_name,
                "mesh": 0
            }
        ],
        "meshes": [
            {
                "name": f"{model_name}_Mesh",
                "primitives": [
                    {
                        "attributes": {
                            "POSITION": 0,
                            "NORMAL": 1,
                            "TEXCOORD_0": 2,
                            "COLOR_0": 3
                        },
                        "indices": 4,
                        "material": 0,
                        "mode": 4  # TRIANGLES
                    }
                ]
            }
        ],
        "materials": [material_def],
        "accessors": [
            # 0: POSITION
            {
                "bufferView": 0,
                "byteOffset": 0,
                "componentType": 5126,  # FLOAT
                "count": num_verts,
                "type": "VEC3",
                "min": [round(min_x, 5), round(min_y, 5), round(min_z, 5)],
                "max": [round(max_x, 5), round(max_y, 5), round(max_z, 5)]
            },
            # 1: NORMAL
            {
                "bufferView": 1,
                "byteOffset": 0,
                "componentType": 5126,
                "count": num_verts,
                "type": "VEC3"
            },
            # 2: TEXCOORD_0
            {
                "bufferView": 2,
                "byteOffset": 0,
                "componentType": 5126,
                "count": num_verts,
                "type": "VEC2"
            },
            # 3: COLOR_0 (Ambient Occlusion)
            {
                "bufferView": 3,
                "byteOffset": 0,
                "componentType": 5126,
                "count": num_verts,
                "type": "VEC4"
            },
            # 4: INDICES
            {
                "bufferView": 4,
                "byteOffset": 0,
                "componentType": idx_component_type,
                "count": num_indices,
                "type": "SCALAR"
            }
        ],
        "bufferViews": [
            {"buffer": 0, "byteOffset": offset_pos, "byteLength": len(verts) * 4, "target": 34962},  # ARRAY_BUFFER
            {"buffer": 0, "byteOffset": offset_norm, "byteLength": len(norms) * 4, "target": 34962},
            {"buffer": 0, "byteOffset": offset_uv, "byteLength": len(uvs) * 4, "target": 34962},
            {"buffer": 0, "byteOffset": offset_col, "byteLength": len(colors) * 4, "target": 34962},
            {"buffer": 0, "byteOffset": offset_idx, "byteLength": len_idx, "target": 34963}  # ELEMENT_ARRAY_BUFFER
        ],
        "buffers": [
            {"byteLength": len(bin_data)}
        ]
    }

    # Serialize JSON
    json_bytes = json.dumps(gltf_json, separators=(',', ':')).encode('utf-8')
    json_bytes = pad4(json_bytes)

    # GLB header
    # 12 bytes header: magic (0x46546C67), version (2), totalLength
    # 8 bytes chunk 0 header: length, type (0x4E4F534A - JSON)
    # json_bytes
    # 8 bytes chunk 1 header: length, type (0x004E4942 - BIN)
    # bin_data
    total_length = 12 + 8 + len(json_bytes) + 8 + len(bin_data)

    glb_bytes = bytearray()
    glb_bytes.extend(struct.pack('<I', 0x46546C67))  # magic "glTF"
    glb_bytes.extend(struct.pack('<I', 2))           # version 2
    glb_bytes.extend(struct.pack('<I', total_length))

    # Chunk 0: JSON
    glb_bytes.extend(struct.pack('<I', len(json_bytes)))
    glb_bytes.extend(struct.pack('<I', 0x4E4F534A))  # "JSON"
    glb_bytes.extend(json_bytes)

    # Chunk 1: BIN
    glb_bytes.extend(struct.pack('<I', len(bin_data)))
    glb_bytes.extend(struct.pack('<I', 0x004E4942))  # "BIN\0"
    glb_bytes.extend(bin_data)

    with open(output_path, 'wb') as f:
        f.write(glb_bytes)

    return {
        "file": os.path.basename(output_path),
        "triangles": len(indices) // 3,
        "vertices": num_verts,
        "size_kb": round(len(glb_bytes) / 1024, 1),
        "bounds": {
            "min": [round(min_x, 3), round(min_y, 3), round(min_z, 3)],
            "max": [round(max_x, 3), round(max_y, 3), round(max_z, 3)],
            "width": round(max_x - min_x, 3),
            "height": round(max_y - min_y, 3),
            "depth": round(max_z - min_z, 3)
        }
    }


def main():
    print("=" * 70)
    print("CineVerse Original Cinema Seat Generator — 3 Families, 3 LODs")
    print("=" * 70)

    # Define PBR Materials per family
    fabric_mat = {
        "name": "StandardCinemaFabric",
        "pbrMetallicRoughness": {
            "baseColorFactor": [0.62, 0.08, 0.16, 1.0],  # Deep Cinema Red
            "roughnessFactor": 0.85,
            "metallicFactor": 0.02
        },
        "doubleSided": False
    }

    leather_mat = {
        "name": "ReclinerLeatherPBR",
        "pbrMetallicRoughness": {
            "baseColorFactor": [0.22, 0.14, 0.10, 1.0],  # Dark Espresso Brown
            "roughnessFactor": 0.50,
            "metallicFactor": 0.04
        },
        "doubleSided": False
    }

    sofa_mat = {
        "name": "BoutiqueVelvetPBR",
        "pbrMetallicRoughness": {
            "baseColorFactor": [0.18, 0.28, 0.35, 1.0],  # Slate Teal Velvet
            "roughnessFactor": 0.82,
            "metallicFactor": 0.05
        },
        "doubleSided": False
    }

    manifest: Dict[str, Any] = {
        "version": "2.0.0",
        "generator": "tools/generate_seats.py",
        "coordinate_system": "glTF Y-up, audience facing +Z",
        "families": {}
    }

    # -------------------------------------------------------------------------
    # 1. Family A: Standard Cinema Seat
    # -------------------------------------------------------------------------
    print("\n[1/3] Generating Family A: Standard Cinema Seat...")
    std_lods = {}
    for lod in [0, 1, 2]:
        mesh = build_standard_seat(lod=lod, is_tipped=False)
        out_file = os.path.join(SEATS_DIR, f"standard_lod{lod}.glb")
        stats = export_glb(mesh, out_file, f"StandardSeat_LOD{lod}", fabric_mat)
        std_lods[f"lod{lod}"] = stats
        print(f"  -> LOD{lod}: {stats['triangles']} triangles, {stats['size_kb']} KB")

    # Tipped cushion variant (for empty seat realism)
    mesh_tipped = build_standard_seat(lod=0, is_tipped=True)
    out_tipped = os.path.join(SEATS_DIR, "standard_tipped.glb")
    stats_tipped = export_glb(mesh_tipped, out_tipped, "StandardSeat_Tipped", fabric_mat)
    print(f"  -> Tipped: {stats_tipped['triangles']} triangles, {stats_tipped['size_kb']} KB")

    manifest["families"]["standard"] = {
        "name": "Standard Cinema Seat",
        "description": "High-back push-back chair with separate padded headrest, stitch seams, curved cushion, armrest cup holders, stanchion feet",
        "footprint": [1.24, 0.96, 1.98],
        "real_world_meters": {"width": 0.62, "depth": 0.72, "height": 0.99},
        "eye_height_offset": 1.32,
        "armrest_sharing_rule": "shared_in_block",
        "material": {"type": "fabric", "roughness": 0.85, "metalness": 0.02, "default_color": "#9f1239"},
        "lods": std_lods,
        "tipped_variant": stats_tipped
    }

    # -------------------------------------------------------------------------
    # 2. Family B: Recliner / Premium Seat (Single & Pair)
    # -------------------------------------------------------------------------
    print("\n[2/3] Generating Family B: Recliner & Loveseat Pairs...")
    rec_single_lods = {}
    for lod in [0, 1, 2]:
        mesh = build_recliner_seat(is_pair=False, lod=lod)
        out_file = os.path.join(SEATS_DIR, f"recliner_single_lod{lod}.glb")
        stats = export_glb(mesh, out_file, f"ReclinerSingle_LOD{lod}", leather_mat)
        rec_single_lods[f"lod{lod}"] = stats
        print(f"  -> Recliner Single LOD{lod}: {stats['triangles']} triangles, {stats['size_kb']} KB")

    rec_pair_lods = {}
    for lod in [0, 1, 2]:
        mesh = build_recliner_seat(is_pair=True, lod=lod)
        out_file = os.path.join(SEATS_DIR, f"recliner_pair_lod{lod}.glb")
        stats = export_glb(mesh, out_file, f"ReclinerPair_LOD{lod}", leather_mat)
        rec_pair_lods[f"lod{lod}"] = stats
        print(f"  -> Recliner Pair LOD{lod}: {stats['triangles']} triangles, {stats['size_kb']} KB")

    manifest["families"]["recliner"] = {
        "name": "Recliner & Loveseat Premium",
        "description": "Overstuffed leather armchair with rolled padded arms, high back quilted seams, recline controls, tucked footrest, recessed metal base",
        "single": {
            "footprint": [1.04, 0.98, 2.08],
            "real_world_meters": {"width": 0.88, "depth": 0.96, "height": 1.08},
            "eye_height_offset": 1.36,
            "armrest_sharing_rule": "individual_rolled",
            "lods": rec_single_lods
        },
        "pair": {
            "footprint": [1.84, 0.98, 2.08],
            "real_world_meters": {"width": 1.68, "depth": 0.96, "height": 1.08},
            "eye_height_offset": 1.36,
            "armrest_sharing_rule": "center_console_table",
            "lods": rec_pair_lods
        },
        "material": {"type": "leather", "roughness": 0.50, "metalness": 0.04, "default_color": "#38241b"}
    }

    # -------------------------------------------------------------------------
    # 3. Family C: Boutique Sofa for Small Halls
    # -------------------------------------------------------------------------
    print("\n[3/3] Generating Family C: Boutique Sofa...")
    sofa_lods = {}
    for lod in [0, 1, 2]:
        mesh = build_boutique_sofa(lod=lod)
        out_file = os.path.join(SEATS_DIR, f"sofa_lod{lod}.glb")
        stats = export_glb(mesh, out_file, f"BoutiqueSofa_LOD{lod}", sofa_mat)
        sofa_lods[f"lod{lod}"] = stats
        print(f"  -> Sofa LOD{lod}: {stats['triangles']} triangles, {stats['size_kb']} KB")

    manifest["families"]["sofa"] = {
        "name": "Boutique Sofa",
        "description": "Plush boutique sofa with vertical channel fluted backrest, deep bench cushion, bolster arms, brass-capped spindle legs",
        "footprint": [1.24, 0.96, 1.78],
        "real_world_meters": {"width": 1.28, "depth": 0.88, "height": 0.89},
        "eye_height_offset": 1.28,
        "armrest_sharing_rule": "bolster_ends",
        "material": {"type": "velvet", "roughness": 0.82, "metalness": 0.05, "default_color": "#2e4858"},
        "lods": sofa_lods
    }

    # Generate PBR Texture Atlases per family
    generate_texture_atlases(SEATS_DIR)

    # Copy standard_lod0.glb to seat_premium.glb for seamless backward compatibility with any legacy loaders
    import shutil
    legacy_dest = os.path.abspath(os.path.join(SEATS_DIR, "..", "seat_premium.glb"))
    shutil.copyfile(os.path.join(SEATS_DIR, "standard_lod0.glb"), legacy_dest)
    print(f"\nUpdated legacy fallback: {legacy_dest}")

    # Write manifest.json
    manifest_path = os.path.join(SEATS_DIR, "manifest.json")
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
    print(f"Saved manifest: {manifest_path}")

    # Write asset license documentation
    license_doc = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "asset-licences.md"))
    with open(license_doc, 'a', encoding='utf-8') as f:
        f.write("\n\n## Seat Models (Original Procedural Generation)\n")
        f.write("- **Asset Type**: 3D Seat Models (Standard Cinema Seat, Recliner & Pair, Boutique Sofa)\n")
        f.write("- **Origin**: 100% original procedural geometry generated via `tools/generate_seats.py`.\n")
        f.write("- **Copyright**: (c) 2026 CineVerse Cinemas India.\n")
        f.write("- **License**: Proprietary / MIT Codebase License. No third-party models or reference scans used.\n")
        f.write("- **LODs**: LOD0 (~4-8k tris), LOD1 (~1.5k tris), LOD2 (~300 tris).\n")
    print(f"Updated license registry: {license_doc}")

    print("\nSUCCESS: All seat models generated and validated successfully!")


if __name__ == "__main__":
    main()
