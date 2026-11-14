"""
Format-specific layout templates and equipment profiles for CineVerse (Stage 3).
Every hall uses the Compact hall's arrangement (two side blocks with a wide centre aisle)
scaled up to match each format's seat count range and technical specifications.
"""
import math
from typing import Dict, Any, List, Tuple

# Exact seat count ranges and equipment profiles by format
FORMAT_SPECS: Dict[str, Dict[str, Any]] = {
    "2D": {
        "min_seats": 220,
        "max_seats": 260,
        "theatre_type": "standard",
        "seat_family": "standard",
        "screen_type_desc": "Flat white matte cinema screen",
        "screen_aspect": 2.39,
        "screen_curved": False,
        "is_direct_led": False,
        "has_projector_beam": True,
        "beam_brightness": "standard",
        "has_glasses_counter": False,
        "has_motion_pods": False,
        "ambient_lighting": "standard",
        "confirmation_note": None,
        "variants": [
            {"bl": 8, "br": 8, "rows": 15},   # 240 seats
            {"bl": 9, "br": 9, "rows": 13},   # 234 seats
            {"bl": 10, "br": 10, "rows": 12}, # 240 seats
            {"bl": 8, "br": 10, "rows": 14},  # 252 seats
            {"bl": 7, "br": 8, "rows": 15},   # 225 seats
            {"bl": 8, "br": 8, "rows": 14},   # 224 seats
        ]
    },
    "3D": {
        "min_seats": 220,
        "max_seats": 260,
        "theatre_type": "standard",
        "seat_family": "standard",
        "screen_type_desc": "Flat high-gain silver 3D screen",
        "screen_aspect": 2.39,
        "screen_curved": False,
        "is_direct_led": False,
        "has_projector_beam": True,
        "beam_brightness": "bright",
        "has_glasses_counter": True,
        "has_motion_pods": False,
        "ambient_lighting": "standard",
        "confirmation_note": None,
        "variants": [
            {"bl": 8, "br": 8, "rows": 15},   # 240 seats
            {"bl": 9, "br": 9, "rows": 14},   # 252 seats
            {"bl": 10, "br": 10, "rows": 11}, # 220 seats
            {"bl": 9, "br": 8, "rows": 14},   # 238 seats
            {"bl": 8, "br": 8, "rows": 16},   # 256 seats
            {"bl": 9, "br": 9, "rows": 13},   # 234 seats
        ]
    },
    "IMAX 2D": {
        "min_seats": 450,
        "max_seats": 560,
        "theatre_type": "flagship",
        "seat_family": "standard",
        "screen_type_desc": "Expansive tall curved IMAX screen with steep rake",
        "screen_aspect": 1.90,
        "screen_curved": True,
        "curve_radius": 28.0,
        "is_direct_led": False,
        "has_projector_beam": True,
        "beam_brightness": "laser",
        "has_glasses_counter": False,
        "has_motion_pods": False,
        "ambient_lighting": "standard",
        "confirmation_note": None,
        "variants": [
            {"bl": 14, "br": 14, "rows": 18}, # 504 seats
            {"bl": 15, "br": 15, "rows": 16}, # 480 seats
            {"bl": 16, "br": 16, "rows": 15}, # 480 seats
            {"bl": 14, "br": 15, "rows": 18}, # 522 seats
            {"bl": 15, "br": 15, "rows": 18}, # 540 seats
            {"bl": 14, "br": 14, "rows": 19}, # 532 seats
        ]
    },
    "IMAX 3D": {
        "min_seats": 450,
        "max_seats": 560,
        "theatre_type": "flagship",
        "seat_family": "standard",
        "screen_type_desc": "High-contrast curved IMAX 3D screen with dual laser booth",
        "screen_aspect": 1.90,
        "screen_curved": True,
        "curve_radius": 28.0,
        "is_direct_led": False,
        "has_projector_beam": True,
        "beam_brightness": "laser",
        "has_glasses_counter": True,
        "has_motion_pods": False,
        "ambient_lighting": "standard",
        "confirmation_note": None,
        "variants": [
            {"bl": 14, "br": 14, "rows": 18}, # 504 seats
            {"bl": 15, "br": 15, "rows": 18}, # 540 seats
            {"bl": 14, "br": 15, "rows": 18}, # 522 seats
            {"bl": 16, "br": 16, "rows": 16}, # 512 seats
            {"bl": 14, "br": 14, "rows": 19}, # 532 seats
            {"bl": 16, "br": 16, "rows": 17}, # 544 seats
        ]
    },
    "4DX": {
        "min_seats": 160,
        "max_seats": 240,
        "theatre_type": "motion_seat",
        "seat_family": "standard",
        "screen_type_desc": "Synchronized 4DX screen with multi-axis motion pod bases",
        "screen_aspect": 2.39,
        "screen_curved": False,
        "is_direct_led": False,
        "has_projector_beam": True,
        "beam_brightness": "standard",
        "has_glasses_counter": False,
        "has_motion_pods": True,
        "ambient_lighting": "ceiling_led_bars",
        "confirmation_note": None,
        "variants": [
            {"bl": 8, "br": 8, "rows": 12},  # 192 seats (4 pods/row)
            {"bl": 8, "br": 8, "rows": 14},  # 224 seats (4 pods/row)
            {"bl": 8, "br": 8, "rows": 15},  # 240 seats (4 pods/row)
            {"bl": 4, "br": 8, "rows": 16},  # 192 seats (3 pods/row)
            {"bl": 8, "br": 8, "rows": 11},  # 176 seats (4 pods/row)
            {"bl": 8, "br": 8, "rows": 13},  # 208 seats (4 pods/row)
        ]
    },
    "4DX 3D": {
        "min_seats": 160,
        "max_seats": 240,
        "theatre_type": "motion_seat",
        "seat_family": "standard",
        "screen_type_desc": "High-gain 4DX 3D screen with motion pods and glasses counter",
        "screen_aspect": 2.39,
        "screen_curved": False,
        "is_direct_led": False,
        "has_projector_beam": True,
        "beam_brightness": "bright",
        "has_glasses_counter": True,
        "has_motion_pods": True,
        "ambient_lighting": "ceiling_led_bars",
        "confirmation_note": None,
        "variants": [
            {"bl": 8, "br": 8, "rows": 12},  # 192 seats
            {"bl": 8, "br": 8, "rows": 14},  # 224 seats
            {"bl": 8, "br": 8, "rows": 15},  # 240 seats
            {"bl": 4, "br": 8, "rows": 16},  # 192 seats
            {"bl": 8, "br": 8, "rows": 13},  # 208 seats
            {"bl": 8, "br": 8, "rows": 11},  # 176 seats
        ]
    },
    "MX4D": {
        "min_seats": 160,
        "max_seats": 240,
        "theatre_type": "motion_seat",
        "seat_family": "standard",
        "screen_type_desc": "MX4D motion auditorium with active pod suspension",
        "screen_aspect": 2.39,
        "screen_curved": False,
        "is_direct_led": False,
        "has_projector_beam": True,
        "beam_brightness": "standard",
        "has_glasses_counter": False,
        "has_motion_pods": True,
        "ambient_lighting": "ceiling_led_bars",
        "confirmation_note": None,
        "variants": [
            {"bl": 8, "br": 8, "rows": 12},  # 192 seats
            {"bl": 8, "br": 8, "rows": 13},  # 208 seats
            {"bl": 8, "br": 8, "rows": 14},  # 224 seats
            {"bl": 4, "br": 8, "rows": 15},  # 180 seats
            {"bl": 8, "br": 8, "rows": 11},  # 176 seats
            {"bl": 8, "br": 8, "rows": 15},  # 240 seats
        ]
    },
    "MX4D 3D": {
        "min_seats": 160,
        "max_seats": 240,
        "theatre_type": "motion_seat",
        "seat_family": "standard",
        "screen_type_desc": "MX4D stereoscopic 3D motion auditorium with glasses station",
        "screen_aspect": 2.39,
        "screen_curved": False,
        "is_direct_led": False,
        "has_projector_beam": True,
        "beam_brightness": "bright",
        "has_glasses_counter": True,
        "has_motion_pods": True,
        "ambient_lighting": "ceiling_led_bars",
        "confirmation_note": None,
        "variants": [
            {"bl": 8, "br": 8, "rows": 12},  # 192 seats
            {"bl": 8, "br": 8, "rows": 14},  # 224 seats
            {"bl": 8, "br": 8, "rows": 13},  # 208 seats
            {"bl": 4, "br": 8, "rows": 16},  # 192 seats
            {"bl": 8, "br": 8, "rows": 15},  # 240 seats
            {"bl": 8, "br": 8, "rows": 11},  # 176 seats
        ]
    },
    "ScreenX": {
        "min_seats": 260,
        "max_seats": 320,
        "theatre_type": "standard",
        "seat_family": "standard",
        "screen_type_desc": "ScreenX 270-degree triple-screen (centre + dual wall projection)",
        "screen_aspect": 2.39,
        "screen_curved": False,
        "is_screenx": True,
        "is_direct_led": False,
        "has_projector_beam": True,
        "beam_brightness": "standard",
        "has_glasses_counter": False,
        "has_motion_pods": False,
        "ambient_lighting": "standard",
        "confirmation_note": None,
        "variants": [
            {"bl": 10, "br": 10, "rows": 14}, # 280 seats
            {"bl": 11, "br": 11, "rows": 13}, # 286 seats
            {"bl": 12, "br": 12, "rows": 12}, # 288 seats
            {"bl": 10, "br": 10, "rows": 15}, # 300 seats
            {"bl": 11, "br": 11, "rows": 14}, # 308 seats
            {"bl": 10, "br": 10, "rows": 13}, # 260 seats
        ]
    },
    "2D SCREEN X": {
        "min_seats": 260,
        "max_seats": 320,
        "theatre_type": "standard",
        "seat_family": "standard",
        "screen_type_desc": "ScreenX panoramic 270-degree dual-wing projection in 2D",
        "screen_aspect": 2.39,
        "screen_curved": False,
        "is_screenx": True,
        "is_direct_led": False,
        "has_projector_beam": True,
        "beam_brightness": "standard",
        "has_glasses_counter": False,
        "has_motion_pods": False,
        "ambient_lighting": "standard",
        "confirmation_note": None,
        "variants": [
            {"bl": 10, "br": 10, "rows": 14}, # 280 seats
            {"bl": 11, "br": 11, "rows": 13}, # 286 seats
            {"bl": 10, "br": 12, "rows": 12}, # 264 seats
            {"bl": 10, "br": 10, "rows": 15}, # 300 seats
            {"bl": 11, "br": 11, "rows": 14}, # 308 seats
            {"bl": 12, "br": 12, "rows": 12}, # 288 seats
        ]
    },
    "3D SCREEN X": {
        "min_seats": 260,
        "max_seats": 320,
        "theatre_type": "standard",
        "seat_family": "standard",
        "screen_type_desc": "ScreenX panoramic 270-degree triple-screen with 3D glasses",
        "screen_aspect": 2.39,
        "screen_curved": False,
        "is_screenx": True,
        "is_direct_led": False,
        "has_projector_beam": True,
        "beam_brightness": "bright",
        "has_glasses_counter": True,
        "has_motion_pods": False,
        "ambient_lighting": "standard",
        "confirmation_note": None,
        "variants": [
            {"bl": 10, "br": 10, "rows": 14}, # 280 seats
            {"bl": 11, "br": 11, "rows": 13}, # 286 seats
            {"bl": 12, "br": 12, "rows": 12}, # 288 seats
            {"bl": 10, "br": 10, "rows": 15}, # 300 seats
            {"bl": 11, "br": 11, "rows": 14}, # 308 seats
            {"bl": 10, "br": 12, "rows": 13}, # 286 seats
        ]
    },
    "ICE": {
        "min_seats": 300,
        "max_seats": 420,
        "theatre_type": "large",
        "seat_family": "standard",
        "screen_type_desc": "Extra-large wide screen with ambient side immersion panels",
        "screen_aspect": 2.39,
        "screen_curved": False,
        "is_direct_led": False,
        "has_projector_beam": True,
        "beam_brightness": "laser",
        "has_glasses_counter": False,
        "has_motion_pods": False,
        "ambient_lighting": "standard",
        "confirmation_note": "details to confirm with the cinema",
        "variants": [
            {"bl": 12, "br": 12, "rows": 15}, # 360 seats
            {"bl": 13, "br": 13, "rows": 14}, # 364 seats
            {"bl": 12, "br": 12, "rows": 14}, # 336 seats
            {"bl": 13, "br": 13, "rows": 15}, # 390 seats
            {"bl": 11, "br": 11, "rows": 15}, # 330 seats
            {"bl": 14, "br": 14, "rows": 13}, # 364 seats
        ]
    },
    "ICE 3D": {
        "min_seats": 300,
        "max_seats": 420,
        "theatre_type": "large",
        "seat_family": "standard",
        "screen_type_desc": "Extra-large wide screen with ambient immersion panels and 3D glasses",
        "screen_aspect": 2.39,
        "screen_curved": False,
        "is_direct_led": False,
        "has_projector_beam": True,
        "beam_brightness": "laser",
        "has_glasses_counter": True,
        "has_motion_pods": False,
        "ambient_lighting": "standard",
        "confirmation_note": "details to confirm with the cinema",
        "variants": [
            {"bl": 12, "br": 12, "rows": 15}, # 360 seats
            {"bl": 13, "br": 13, "rows": 14}, # 364 seats
            {"bl": 12, "br": 12, "rows": 16}, # 384 seats
            {"bl": 11, "br": 11, "rows": 15}, # 330 seats
            {"bl": 13, "br": 13, "rows": 15}, # 390 seats
            {"bl": 12, "br": 12, "rows": 14}, # 336 seats
        ]
    },
    "P[XL]": {
        "min_seats": 300,
        "max_seats": 420,
        "theatre_type": "large",
        "seat_family": "standard",
        "screen_type_desc": "Premium extra-large giant wide screen with dual laser projection",
        "screen_aspect": 2.39,
        "screen_curved": False,
        "is_direct_led": False,
        "has_projector_beam": True,
        "beam_brightness": "laser",
        "has_glasses_counter": False,
        "has_motion_pods": False,
        "ambient_lighting": "standard",
        "confirmation_note": "details to confirm with the cinema",
        "variants": [
            {"bl": 12, "br": 12, "rows": 16}, # 384 seats
            {"bl": 13, "br": 13, "rows": 14}, # 364 seats
            {"bl": 14, "br": 14, "rows": 13}, # 364 seats
            {"bl": 11, "br": 11, "rows": 15}, # 330 seats
            {"bl": 12, "br": 12, "rows": 15}, # 360 seats
            {"bl": 13, "br": 13, "rows": 15}, # 390 seats
        ]
    },
    "EPIQ": {
        "min_seats": 300,
        "max_seats": 420,
        "theatre_type": "large",
        "seat_family": "standard",
        "screen_type_desc": "EPIQ premium giant screen with high-power laser and custom sound",
        "screen_aspect": 2.39,
        "screen_curved": False,
        "is_direct_led": False,
        "has_projector_beam": True,
        "beam_brightness": "laser",
        "has_glasses_counter": False,
        "has_motion_pods": False,
        "ambient_lighting": "standard",
        "confirmation_note": "details to confirm with the cinema",
        "variants": [
            {"bl": 13, "br": 13, "rows": 15}, # 390 seats
            {"bl": 12, "br": 12, "rows": 15}, # 360 seats
            {"bl": 14, "br": 14, "rows": 14}, # 392 seats
            {"bl": 13, "br": 13, "rows": 16}, # 416 seats
            {"bl": 11, "br": 11, "rows": 14}, # 308 seats
            {"bl": 12, "br": 12, "rows": 16}, # 384 seats
        ]
    },
    "Onyx (Samsung Onyx LED)": {
        "min_seats": 180,
        "max_seats": 260,
        "theatre_type": "standard",
        "seat_family": "standard",
        "screen_type_desc": "Direct-view Samsung Onyx 4K HDR LED with thin black bezel (no projector beam)",
        "screen_aspect": 1.90,
        "screen_curved": False,
        "is_direct_led": True,
        "bezel_width_m": 0.04,
        "has_projector_beam": False,
        "beam_brightness": "none",
        "has_glasses_counter": False,
        "has_motion_pods": False,
        "ambient_lighting": "standard",
        "confirmation_note": None,
        "variants": [
            {"bl": 9, "br": 9, "rows": 12},   # 216 seats
            {"bl": 8, "br": 8, "rows": 13},   # 208 seats
            {"bl": 10, "br": 10, "rows": 11}, # 220 seats
            {"bl": 8, "br": 8, "rows": 15},   # 240 seats
            {"bl": 9, "br": 9, "rows": 14},   # 252 seats
            {"bl": 8, "br": 8, "rows": 12},   # 192 seats
        ]
    },
    "Dolby Cinema": {
        "min_seats": 200,
        "max_seats": 300,
        "theatre_type": "luxury_recliner",
        "seat_family": "recliner",
        "screen_type_desc": "Dolby Vision HDR laser screen with dark matte acoustics and plush leather recliners",
        "screen_aspect": 2.39,
        "screen_curved": True,
        "curve_radius": 32.0,
        "is_direct_led": False,
        "has_projector_beam": True,
        "beam_brightness": "laser",
        "has_glasses_counter": False,
        "has_motion_pods": False,
        "ambient_lighting": "minimal_matte",
        "confirmation_note": None,
        "variants": [
            {"bl": 7, "br": 7, "rows": 16},   # 224 seats (recliner)
            {"bl": 6, "br": 6, "rows": 18},   # 216 seats (recliner)
            {"bl": 8, "br": 8, "rows": 15},   # 240 seats (recliner)
            {"bl": 7, "br": 7, "rows": 18},   # 252 seats (recliner)
            {"bl": 8, "br": 8, "rows": 16},   # 256 seats (recliner)
            {"bl": 8, "br": 8, "rows": 18},   # 288 seats (recliner)
        ]
    },
}

ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def generate_format_layout(
    screen_format: str,
    variant_idx: int,
    sound_system: str = "Dolby Atmos",
    projection_type: str = "4K Laser",
    cinema_id: int = 1
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """
    Generates a deterministic layout with two side blocks and a wide centre aisle,
    matching the format's exact specifications, seat count range, and equipment profile.
    """
    spec = FORMAT_SPECS.get(screen_format, FORMAT_SPECS["2D"])
    variants = spec["variants"]
    # Deterministic variant selection using cinema_id and variant_idx to guarantee unique signature in cinema
    chosen_variant = variants[(variant_idx + cinema_id) % len(variants)]
    
    bl = chosen_variant["bl"]
    br = chosen_variant["br"]
    num_rows = chosen_variant["rows"]
    total_seats = (bl + br) * num_rows

    is_recliner = spec.get("seat_family") == "recliner"
    is_motion = spec.get("has_motion_pods", False)
    
    # Signature notation: SIG-{FORMAT_SLUG}-L{bl}-R{br}-{rows}R
    fmt_slug = screen_format.replace(" ", "").replace("(", "").replace(")", "").replace("[", "").replace("]", "").upper()
    extra_tag = "-REC" if is_recliner else ("-POD4" if is_motion else "")
    layout_signature = f"SIG-{fmt_slug}-L{bl}-R{br}-{num_rows}R{extra_tag}"

    rows = [ALPHABET[i] for i in range(num_rows)]
    seats_per_row = bl + br
    aisles = [bl]  # Center aisle between left and right block

    # Screen dimensions
    is_flagship = spec.get("theatre_type") == "flagship"
    is_large = spec.get("theatre_type") == "large"
    is_dolby = screen_format == "Dolby Cinema"

    if is_flagship or is_dolby:
        screen_width = 24.0  # 12m
    elif is_large:
        screen_width = 20.0  # 10m
    else:
        screen_width = 16.0  # 8m
    screen_height = screen_width / spec.get("screen_aspect", 2.39)

    seat_pitch = 1.6 if is_recliner else 1.15
    row_pitch = 1.40 if is_recliner else 1.30
    tier_rise = 0.28 if (is_flagship or is_dolby) else 0.22
    aisle_gap = 2.8 if is_recliner else 2.2  # Wide centre aisle in scene units (~1.1 to 1.4m)

    # Distance rule: First row >= 0.62x screen width, last row <= 2.0x screen width
    screen_width_m = screen_width * 0.5
    min_dist_from_screen_scene = (screen_width_m * 0.62) * 2.0
    row_a_z = round(-1.255 - min_dist_from_screen_scene, 3)
    row_a_y = 1.365

    # Category Bands (Front: ~25%, Prime: ~50%, Premier: ~25%)
    front_cutoff = max(2, int(num_rows * 0.25))
    prime_cutoff = max(front_cutoff + 2, int(num_rows * 0.70))
    front_rows = rows[:front_cutoff]
    prime_rows = rows[front_cutoff:prime_cutoff]
    premier_rows = rows[prime_cutoff:]

    category_bands = [
        {"category": "Front", "rows": front_rows, "price_multiplier": 0.8},
        {"category": "Prime", "rows": prime_rows, "price_multiplier": 1.0},
        {"category": "Premier", "rows": premier_rows, "price_multiplier": 1.4},
    ]

    accessible_seats = ["A01", "A02"]

    seat_records = []
    for r_idx, row_label in enumerate(rows):
        row_z = row_a_z - (r_idx * row_pitch)
        row_y = row_a_y + (r_idx * tier_rise)
        
        # Category
        if row_label in front_rows:
            category = "Front"
        elif row_label in premier_rows:
            category = "Premier"
        else:
            category = "Prime"

        for s_idx in range(1, seats_per_row + 1):
            seat_id = f"{row_label}{str(s_idx).zfill(2)}"
            
            # X coordinate computation: Left block (+X) to Right block (-X)
            # Seat 01 is on audience's left (+X)
            if s_idx <= bl:
                # Left block
                seat_in_block = s_idx - 1
                dist_from_aisle = (bl - 1 - seat_in_block) * seat_pitch
                x_pos = (aisle_gap / 2.0) + dist_from_aisle
            else:
                # Right block
                seat_in_block = s_idx - bl - 1
                dist_from_aisle = seat_in_block * seat_pitch
                x_pos = -(aisle_gap / 2.0) - dist_from_aisle

            # Eye positions: seated height is +0.65 above cushion, distance to screen
            eye_y = row_y + 0.65
            dist_to_screen = math.sqrt(x_pos * x_pos + (-1.255 - row_z) ** 2) * 0.5
            v_angle = math.degrees(math.atan2(2.5 - eye_y, abs(row_z - (-1.255))))
            h_angle = math.degrees(math.atan2(x_pos, abs(row_z - (-1.255))))

            is_acc = seat_id in accessible_seats
            seat_type = "accessible" if is_acc else ("recliner" if is_recliner else "standard")
            
            # Pod id for motion seats (groups of 4)
            pod_id = None
            if is_motion:
                block_offset = 0 if s_idx <= bl else bl
                idx_in_block = s_idx - 1 if s_idx <= bl else (s_idx - bl - 1)
                pod_index = idx_in_block // 4
                pod_side = "L" if s_idx <= bl else "R"
                pod_id = f"pod_{row_label}_{pod_side}{pod_index + 1}"

            seat_records.append({
                "seat_id": seat_id,
                "row": row_label,
                "number": s_idx,
                "category": category,
                "node_name": f"seat_{row_label}_{str(s_idx).zfill(2)}",
                "eye_x": round(x_pos, 3),
                "eye_y": round(eye_y, 3),
                "eye_z": round(row_z, 3),
                "distance_to_screen": round(dist_to_screen, 1),
                "vertical_angle_deg": round(v_angle, 1),
                "horizontal_angle_deg": round(h_angle, 1),
                "is_accessible": is_acc,
                "seat_type": seat_type,
                "level": "stalls",
                "section": "Stalls",
                "pod_id": pod_id,
            })

    # Equipment profile description for side panel
    equipment_profile = {
        "screen_description": spec["screen_type_desc"],
        "screen_aspect": spec.get("screen_aspect", 2.39),
        "screen_curved": spec.get("screen_curved", False),
        "is_direct_led": spec.get("is_direct_led", False),
        "is_screenx": spec.get("is_screenx", False),
        "has_glasses_counter": spec.get("has_glasses_counter", False),
        "has_motion_pods": spec.get("has_motion_pods", False),
        "has_projector_beam": spec.get("has_projector_beam", True),
        "beam_brightness": spec.get("beam_brightness", "standard"),
        "seat_family": spec.get("seat_family", "standard"),
        "sound_system": sound_system,
        "projection_type": projection_type,
        "confirmation_note": spec.get("confirmation_note"),
    }

    layout_data = {
        "theatre_type": spec["theatre_type"],
        "theatre_type_label": f"{screen_format} Auditorium",
        "layout_signature": layout_signature,
        "arrangement_pattern": "two_side_blocks_wide_aisle",
        "blocks_pattern": [bl, br],
        "aisles": aisles,
        "rows": rows,
        "seats_per_row": seats_per_row,
        "accessible_seats": accessible_seats,
        "category_bands": category_bands,
        "screen_format": screen_format,
        "sound_system": sound_system,
        "projection_type": projection_type,
        "equipment_profile": equipment_profile,
        "screen": {
            "width": screen_width,
            "height": round(screen_height, 2),
            "aspect": spec.get("screen_aspect", 2.39),
            "curved": spec.get("screen_curved", False),
            "curve_radius": spec.get("curve_radius", 0.0),
            "is_direct_led": spec.get("is_direct_led", False),
            "bezel_width_m": spec.get("bezel_width_m", 0.1),
        },
        "documented_scale": {
            "meters_to_scene": 2.0,
            "scene_to_meters": 0.5,
            "seat_width_m": 0.85 if is_recliner else 0.55,
            "row_pitch_m": 1.4 if is_recliner else 1.05,
            "rake_step_m": tier_rise * 0.5,
            "aisle_width_m": aisle_gap * 0.5,
            "ceiling_height_m": 9.5 if spec.get("theatre_type") == "flagship" else 8.5,
        },
        "seats": seat_records,
    }

    return layout_data, seat_records
