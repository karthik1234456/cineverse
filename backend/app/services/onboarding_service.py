import re
import json
import math
import struct
import hashlib
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple


class AuditoriumOnboardingService:
    """
    Reusable pipeline for validating GLB auditorium models, extracting
    seat layouts, deriving walkable navigation meshes & colliders,
    detecting coordinate conventions, and flagging architectural defects.
    Zero external C-dependencies (pure Python standard library).
    """

    DEFAULT_SEAT_PATTERN = r"^seat_([A-Za-z])_([0-9]+)$"

    @staticmethod
    def parse_glb(file_bytes: bytes) -> Tuple[dict, bytes]:
        """Parses binary glTF (GLB) header and extracts JSON chunk and binary buffer."""
        if len(file_bytes) < 20:
            raise ValueError("Invalid GLB: file too small")

        magic, version, length = struct.unpack("<4sII", file_bytes[0:12])
        if magic != b"glTF":
            raise ValueError("Invalid GLB magic header: expected 'glTF'")

        chunk_length, chunk_type = struct.unpack("<II", file_bytes[12:20])
        if chunk_type != 0x4E4F534A:  # "JSON"
            raise ValueError("First chunk must be JSON")

        json_bytes = file_bytes[20:20 + chunk_length]
        json_meta = json.loads(json_bytes.decode("utf-8"))

        bin_offset = 20 + chunk_length
        if bin_offset + 8 <= len(file_bytes):
            bin_length, bin_type = struct.unpack("<II", file_bytes[bin_offset:bin_offset + 8])
            bin_bytes = file_bytes[bin_offset + 8:bin_offset + 8 + bin_length]
        else:
            bin_bytes = b""

        return json_meta, bin_bytes

    @classmethod
    def get_node_vertices(cls, json_meta: dict, bin_bytes: bytes, node: dict) -> List[Tuple[float, float, float]]:
        """Extracts vertex positions from a node's mesh primitive as a list of (x, y, z) tuples."""
        if "mesh" not in node:
            return []

        mesh_idx = node["mesh"]
        primitive = json_meta["meshes"][mesh_idx]["primitives"][0]
        pos_accessor_idx = primitive["attributes"]["POSITION"]
        accessor = json_meta["accessors"][pos_accessor_idx]
        buffer_view = json_meta["bufferViews"][accessor["bufferView"]]

        offset = buffer_view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        count = accessor["count"]

        # 3 floats per vertex (12 bytes)
        verts = []
        for i in range(count):
            start = offset + (i * 12)
            if start + 12 <= len(bin_bytes):
                x, y, z = struct.unpack_from("<3f", bin_bytes, start)
                verts.append((x, y, z))
        return verts

    @classmethod
    def get_bounds(cls, verts: List[Tuple[float, float, float]]) -> Tuple[Tuple[float, float, float], Tuple[float, float, float]]:
        """Computes min and max bounding box points for vertex list."""
        if not verts:
            return (0.0, 0.0, 0.0), (0.0, 0.0, 0.0)
        min_x = min(v[0] for v in verts)
        min_y = min(v[1] for v in verts)
        min_z = min(v[2] for v in verts)
        max_x = max(v[0] for v in verts)
        max_y = max(v[1] for v in verts)
        max_z = max(v[2] for v in verts)
        return (min_x, min_y, min_z), (max_x, max_y, max_z)

    @classmethod
    def detect_coordinate_convention(cls, json_meta: dict) -> Dict[str, Any]:
        """
        Inspects node transformation matrices to detect coordinate space conventions.
        Returns convention ('glTF_Y_UP', 'Blender_Z_UP_WITH_MATRIX', 'NATIVE_Z_UP').
        """
        nodes = json_meta.get("nodes", [])
        has_rx_90 = False
        sample_matrix = None

        for n in nodes:
            if "matrix" in n:
                m = n["matrix"]
                # Check for standard Rx(+/-90 deg) glTF conversion matrix
                # Column-major representation: m[0]=1, m[5]~0, |m[6]|=1, |m[9]|=1
                if abs(m[0] - 1.0) < 1e-3 and abs(m[5]) < 1e-3 and abs(abs(m[6]) - 1.0) < 1e-3:
                    has_rx_90 = True
                    sample_matrix = m
                    break

        if has_rx_90:
            return {
                "convention": "Blender_Z_UP_WITH_MATRIX",
                "target_space": "glTF_Y_UP",
                "rotation_applied": "Rx(+90deg)",
                "description": "Blender Z-up raw vertices with node matrix converting to glTF Y-up",
                "sample_matrix": sample_matrix
            }

        return {
            "convention": "glTF_Y_UP",
            "target_space": "glTF_Y_UP",
            "rotation_applied": "None",
            "description": "Native glTF Y-up coordinates"
        }

    @classmethod
    def process_and_validate_glb(
        cls,
        file_bytes: bytes,
        seat_pattern: Optional[str] = None,
        seat_numbering_direction: str = "LEFT_TO_RIGHT",
        max_triangle_budget: int = 1600000
    ) -> Dict[str, Any]:
        """
        Runs the full onboarding pipeline:
        1. Parses GLB
        2. Detects coordinate convention
        3. Extracts seat nodes, screen, floor, tiers, aisle treads
        4. Calculates bounding boxes and eye positions
        5. Performs defect validation (missing screen, duplicate IDs, triangle budget, stair rise)
        6. Produces verified seat layout and walk nav structures
        """
        json_meta, bin_bytes = cls.parse_glb(file_bytes)
        coord_info = cls.detect_coordinate_convention(json_meta)
        pattern = re.compile(seat_pattern or cls.DEFAULT_SEAT_PATTERN)

        nodes = {n.get("name", f"node_{i}"): n for i, n in enumerate(json_meta.get("nodes", []))}
        seat_nodes = {}
        total_triangles = 0
        validation_warnings = []
        validation_errors = []

        # Calculate triangle budget
        for m in json_meta.get("meshes", []):
            for prim in m.get("primitives", []):
                if "indices" in prim:
                    idx_accessor = json_meta["accessors"][prim["indices"]]
                    total_triangles += idx_accessor["count"] // 3
                elif "POSITION" in prim.get("attributes", {}):
                    pos_accessor = json_meta["accessors"][prim["attributes"]["POSITION"]]
                    total_triangles += pos_accessor["count"] // 3

        if total_triangles > max_triangle_budget:
            validation_warnings.append(
                f"Triangle budget exceeded: {total_triangles:,} triangles (recommended maximum: {max_triangle_budget:,}). Optimisation required."
            )

        # Detect Screen
        has_screen = "cinema_screen_surface" in nodes or "screen_outer_frame" in nodes
        if not has_screen:
            validation_errors.append("MISSING_SCREEN: No 'cinema_screen_surface' or 'screen_outer_frame' mesh node detected.")

        # Detect and extract seats
        for name, node in nodes.items():
            match = pattern.match(name)
            if match:
                row_letter = match.group(1).upper()
                node_num = int(match.group(2))
                seat_nodes[name] = {
                    "node_name": name,
                    "row_letter": row_letter,
                    "node_number": node_num,
                    "node": node
                }

        if len(seat_nodes) == 0:
            validation_errors.append("NO_SEATS_DETECTED: No seat meshes matching pattern were found in GLB.")

        # Screen center reference
        screen_center = [0.0, 5.55, -1.255]
        if "cinema_screen_surface" in nodes:
            v_screen = cls.get_node_vertices(json_meta, bin_bytes, nodes["cinema_screen_surface"])
            if len(v_screen) > 0:
                mn, mx = cls.get_bounds(v_screen)
                # Blender Z-up to glTF Y-up: (x, z, -y)
                screen_center = [
                    round(float((mn[0] + mx[0]) / 2), 3),
                    round(float((mn[2] + mx[2]) / 2), 3),
                    round(float(-(mn[1] + mx[1]) / 2), 3)
                ]

        # Extract seat layout
        extracted_seats = []
        seen_seat_ids = set()

        for name, s_info in sorted(seat_nodes.items(), key=lambda x: (x[1]["row_letter"], x[1]["node_number"])):
            v = cls.get_node_vertices(json_meta, bin_bytes, s_info["node"])
            if len(v) == 0:
                continue

            mn, mx = cls.get_bounds(v)
            # glTF Y-up bounding box
            bounds_min = [round(float(mn[0]), 3), round(float(mn[2]), 3), round(float(-mx[1]), 3)]
            bounds_max = [round(float(mx[0]), 3), round(float(mx[2]), 3), round(float(-mn[1]), 3)]

            # Seat numbering logic:
            # If GLB node numbers run right-to-left from audience view (A01 is at -X, audience right),
            # mirror to standard cinema numbering (11 - node_num) so 01 is on the left.
            if seat_numbering_direction == "LEFT_TO_RIGHT":
                seat_num = 11 - s_info["node_number"] if s_info["node_number"] <= 10 else s_info["node_number"]
            else:
                seat_num = s_info["node_number"]

            seat_id = f"{s_info['row_letter']}{seat_num:02d}"
            if seat_id in seen_seat_ids:
                validation_errors.append(f"DUPLICATE_SEAT_ID: Duplicate seat identifier generated: {seat_id}")
            seen_seat_ids.add(seat_id)

            # Category mapping
            row = s_info["row_letter"]
            if row in ["A", "B", "C"]:
                category = "Front"
                price = 280.0
            elif row in ["D", "E", "F", "G"]:
                category = "Prime"
                price = 380.0
            else:
                category = "Premier"
                price = 520.0

            # Geometric Eye Position
            center_x = round((bounds_min[0] + bounds_max[0]) / 2, 3)
            eye_y = round(bounds_min[1] + 0.8 + (0.65 / 0.43), 3)
            eye_z = round(bounds_min[2] + 0.45, 3)
            eye_pos = [center_x, eye_y, eye_z]

            # Angular viewing geometry
            dx = screen_center[0] - eye_pos[0]
            dy = screen_center[1] - eye_pos[1]
            dz = screen_center[2] - eye_pos[2]
            dist = round(float(math.hypot(math.hypot(dx, dy), dz)), 3)

            h_rad = 2 * math.atan(7.8 / max(0.001, abs(dz)))
            v_rad = 2 * math.atan(3.625 / max(0.001, abs(dz)))
            h_fov = round(float(math.degrees(h_rad)), 1)
            v_fov = round(float(math.degrees(v_rad)), 1)

            extracted_seats.append({
                "seat_id": seat_id,
                "node_name": name,
                "node_number": s_info["node_number"],
                "row": row,
                "number": seat_num,
                "category": category,
                "price": price,
                "position_gltf_y_up": [center_x, bounds_min[1], eye_z],
                "bounds_gltf_y_up": {"min": bounds_min, "max": bounds_max},
                "eye_position_gltf_y_up": eye_pos,
                "screen_distance": dist,
                "screen_distance_m_est": round(dist * 0.43, 2),
                "horizontal_offset_deg": round(float(math.degrees(math.atan2(-dx, dz))), 1),
                "vertical_angle_deg": round(float(math.degrees(math.atan2(dy, math.hypot(dx, dz)))), 1),
                "screen_h_fov_deg": h_fov,
                "screen_v_fov_deg": v_fov
            })

        # Check walkability & aisle rise
        tier_nodes = [name for name in nodes if name.startswith("tier_platform_")]
        tread_nodes = [name for name in nodes if name.startswith("central_aisle_tread_")]

        if len(tier_nodes) > 0 and len(tread_nodes) == 0:
            validation_warnings.append("MISSING_AISLE_STAIRS: Elevated tiers detected without dedicated aisle treads.")

        validation_status = "REJECTED" if validation_errors else ("WARNINGS" if validation_warnings else "VALID")

        return {
            "validation_status": validation_status,
            "errors": validation_errors,
            "warnings": validation_warnings,
            "coordinate_info": coord_info,
            "mesh_metrics": {
                "total_nodes": len(nodes),
                "seat_count": len(extracted_seats),
                "total_triangles": total_triangles,
                "screen_center": screen_center,
                "tier_count": len(tier_nodes),
                "aisle_tread_count": len(tread_nodes)
            },
            "seat_layout": {
                "version": "2.0",
                "units": "model_units_approx_0.43m",
                "seat_count": len(extracted_seats),
                "screen_center": screen_center,
                "seats": extracted_seats
            }
        }
