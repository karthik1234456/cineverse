"""
CineVerse Theatre Type Registry (Python / Backend)
==================================================
Defines architectural templates, real-world dimensions in metres,
scale conversion factor to scene units, target capacities, and arrangement patterns.

SCALE RATIO:
- 1.0 real-world metre = 2.0 scene units (METERS_TO_SCENE = 2.0)
- 1.0 scene unit = 0.50 metres (SCENE_TO_METERS = 0.50)

EXCEPTION:
- The supplied 100-seat hall ("cineverse_auditorium_v2.glb") keeps its own historical scale
  (~1.28u width ~ 0.55m; ~0.43m per unit) and is formally designated the "Compact hall".
"""

from typing import Dict, Any, List, Optional, Tuple

METERS_TO_SCENE = 2.0
SCENE_TO_METERS = 0.5

THEATRE_TYPES = {
    "compact": {
        "id": "compact",
        "name": "Compact Hall",
        "label": "Compact 3D Hall (Reference)",
        "target_seats": (100, 100),
        "typical_seats": 100,
        "arrangement": "triple_block",
        "real_world": {
            "seat_width_m": 0.55,
            "row_pitch_m": 1.05,
            "rake_step_m": 0.18,
            "aisle_width_m": 1.20,
            "ceiling_height_m": 8.5,
            "screen_width_m": 15.6 * 0.43,
            "screen_height_m": 7.25 * 0.43,
        },
        "scene_units": {
            "seat_pitch": 1.20,
            "row_pitch": 1.50,
            "tier_rise": 0.22,
            "aisle_gap": 1.20,
            "ceiling_height": 11.2,
            "screen_width": 15.6,
            "screen_height": 7.25,
        },
        "screen_type": {
            "type": "standard_flat",
            "name": "Standard flat screen",
            "aspect_ratio": 2.15,
            "is_curved": False,
            "has_projector_beam": True,
            "finish": "matte_white",
            "bezel": {"width": 0.25, "color": "#111115", "has_frame": True}
        },
        "description": "Original 100-seat demonstration hall with bespoke GLB geometry and 10 rows."
    },
    "standard": {
        "id": "standard",
        "name": "Standard Multiplex Hall",
        "label": "Standard Stadium Hall",
        "target_seats": (160, 260),
        "typical_seats": 240,
        "arrangement": "triple_block",
        "real_world": {
            "seat_width_m": 0.52,
            "row_pitch_m": 1.00,
            "rake_step_m": 0.17,
            "aisle_width_m": 1.20,
            "ceiling_height_m": 10.0,
            "screen_width_m": 14.0,
            "screen_height_m": 6.5,
        },
        "scene_units": {
            "seat_pitch": 1.20,
            "row_pitch": 2.00,
            "tier_rise": 0.34,
            "aisle_gap": 2.40,
            "ceiling_height": 20.0,
            "screen_width": 28.0,
            "screen_height": 13.0,
        },
        "screen_type": {
            "type": "standard_flat",
            "name": "Standard flat screen",
            "aspect_ratio": 2.15,
            "is_curved": False,
            "has_projector_beam": True,
            "finish": "matte_white",
            "bezel": {"width": 0.25, "color": "#111115", "has_frame": True}
        },
        "palette": {
            "fabric_primary": "#781422",
            "fabric_secondary": "#8a1828",
            "wall_color": "#242730",
            "panel_color": "#2d313c",
            "slat_color": "#1e2129",
            "ceiling_color": "#101626",
            "cove_color": "#2563eb",
            "skirting_color": "#3b82f6",
            "carpet_color": "#1c1d22",
            "runner_color": "#242732",
            "trim_color": "#334155",
            "stage_lip_color": "#1a1b20",
        },
        "description": "Wide straight-row layout with a centre block and two narrower side blocks, navy coffered ceiling, blue wall-wash lighting, dark charcoal carpet, and deep red fabric seats."
    },
    "large": {
        "id": "large",
        "name": "Large Format Cinema",
        "label": "Large Format Auditorium",
        "target_seats": (300, 420),
        "typical_seats": 420,
        "arrangement": "triple_block",
        "real_world": {
            "seat_width_m": 0.56,
            "row_pitch_m": 1.05,
            "rake_step_m": 0.19,
            "aisle_width_m": 1.25,
            "ceiling_height_m": 12.0,
            "screen_width_m": 20.0,
            "screen_height_m": 9.3,
        },
        "scene_units": {
            "seat_pitch": 1.12,
            "row_pitch": 2.10,
            "tier_rise": 0.38,
            "aisle_gap": 2.50,
            "ceiling_height": 24.0,
            "screen_width": 40.0,
            "screen_height": 18.6,
        },
        "screen_type": {
            "type": "large_curved",
            "name": "Large curved screen",
            "aspect_ratio": 2.15,
            "is_curved": True,
            "curve_radius_m": 32.0,
            "has_projector_beam": True,
            "finish": "matte_white",
            "bezel": {"width": 0.20, "color": "#090a0f", "has_frame": True}
        },
        "description": "High-capacity 18-24 row auditorium with triple blocks (6-9-6) and steep rake."
    },
    "flagship": {
        "id": "flagship",
        "name": "Flagship Large Format",
        "label": "Flagship Large Format Auditorium",
        "target_seats": (420, 560),
        "typical_seats": 560,
        "arrangement": "curved_flagship",
        "real_world": {
            "seat_width_m": 0.58,
            "row_pitch_m": 1.10,
            "rake_step_m": 0.20,
            "aisle_width_m": 1.30,
            "ceiling_height_m": 14.0,
            "screen_width_m": 25.0,
            "screen_height_m": 13.5,
        },
        "scene_units": {
            "seat_pitch": 1.16,
            "row_pitch": 2.20,
            "tier_rise": 0.40,
            "aisle_gap": 2.60,
            "ceiling_height": 28.0,
            "screen_width": 50.0,
            "screen_height": 27.0,
        },
        "screen_type": {
            "type": "large_curved",
            "name": "Large curved screen",
            "brand_name": "Large Format",
            "aspect_ratio": 1.85,
            "is_curved": True,
            "curve_radius_m": 28.0,
            "has_projector_beam": True,
            "finish": "matte_white",
            "bezel": {"width": 0.15, "color": "#05070a", "has_frame": True}
        },
        "description": "Colossal 20-row flagship hall with 25m curved screen, curved seating arc, and sweet spot."
    },
    "motion_seat": {
        "id": "motion_seat",
        "name": "Motion-seat Hall",
        "label": "Motion-seat Hall",
        "licensed_name": "Motion-seat Hall",
        "licensed_label": "Motion-seat Hall",
        "target_seats": (160, 280),
        "typical_seats": 240,
        "arrangement": "motion_pods",
        "real_world": {
            "seat_width_m": 0.56,
            "row_pitch_m": 1.25,
            "rake_step_m": 0.24,
            "aisle_width_m": 1.25,
            "ceiling_height_m": 11.5,
            "screen_width_m": 18.0,
            "screen_height_m": 8.5,
        },
        "scene_units": {
            "seat_pitch": 1.28,
            "row_pitch": 2.50,
            "tier_rise": 0.48,
            "aisle_gap": 2.50,
            "ceiling_height": 23.0,
            "screen_width": 36.0,
            "screen_height": 17.0,
        },
        "screen_type": {
            "type": "panoramic_wrap",
            "name": "Panoramic wrap screen",
            "aspect_ratio": 2.12,
            "is_curved": False,
            "has_projector_beam": True,
            "finish": "matte_white",
            "bezel": {"width": 0.25, "color": "#0a0d14", "has_frame": True, "clear_frame": True},
            "wrap_panels": {
                "side_angle_deg": 25.0,
                "side_width_ratio": 0.42,
                "side_height_ratio": 0.82
            }
        },
        "palette": {
            "fabric_primary": "#17191d",
            "fabric_secondary": "#22252b",
            "wall_color": "#0a0b0e",
            "panel_color": "#121418",
            "slat_color": "#16191f",
            "ceiling_color": "#06070a",
            "cove_color": "#2563eb",
            "skirting_color": "#ef4444",
            "carpet_color": "#121316",
            "runner_color": "#181b20",
            "trim_color": "#38bdf8",
            "stage_lip_color": "#101216",
        },
        "features": {
            "motion_seats": True,
            "panoramic_wrap": True,
        },
        "description": "Black walls and ceiling with radiating blue, red and white LED bars, black seats in pods of four on visible platform bases with red LED edges, and wrap screen."
    },
    "luxury_recliner": {
        "id": "luxury_recliner",
        "name": "Luxury Recliner Hall",
        "label": "VIP Luxury Recliner Lounge",
        "target_seats": (80, 160),
        "typical_seats": 128,
        "arrangement": "luxury_pairs",
        "real_world": {
            "seat_width_m": 0.92,
            "row_pitch_m": 1.42,
            "rake_step_m": 0.22,
            "aisle_width_m": 1.40,
            "ceiling_height_m": 9.0,
            "screen_width_m": 11.0,
            "screen_height_m": 5.2,
        },
        "scene_units": {
            "seat_pitch": 2.16,
            "row_pitch": 2.84,
            "tier_rise": 0.44,
            "aisle_gap": 2.80,
            "ceiling_height": 18.0,
            "screen_width": 22.0,
            "screen_height": 10.4,
        },
        "screen_type": {
            "type": "premium_direct_view",
            "name": "Premium direct-view screen",
            "aspect_ratio": 2.08,
            "is_curved": False,
            "has_projector_beam": False,
            "finish": "glossy_led",
            "bezel": {"width": 0.08, "color": "#050505", "thin_black": True, "has_frame": True}
        },
        "palette": {
            "fabric_primary": "#9c5c2e",
            "fabric_secondary": "#a66838",
            "wall_color": "#0d0d10",
            "panel_color": "#17171a",
            "slat_color": "#381c12",
            "ceiling_color": "#08080a",
            "cove_color": "#f59e0b",
            "skirting_color": "#d97706",
            "carpet_color": "#1c1815",
            "runner_color": "#281a14",
            "trim_color": "#d97706",
            "stage_lip_color": "#141416",
        },
        "description": "Black walls with vertical amber LED outline panels, amber ceiling edge strip, quilted caramel leather recliners with wooden swivel tables, and dark wood trim."
    },
    "boutique": {
        "id": "boutique",
        "name": "Boutique Plush Velvet Salon",
        "label": "Boutique Velvet Salon",
        "target_seats": (30, 60),
        "typical_seats": 48,
        "arrangement": "boutique_salon",
        "real_world": {
            "seat_width_m": 0.90,
            "row_pitch_m": 1.35,
            "rake_step_m": 0.16,
            "aisle_width_m": 1.20,
            "ceiling_height_m": 8.0,
            "screen_width_m": 12.0,
            "screen_height_m": 5.6,
        },
        "scene_units": {
            "seat_pitch": 1.80,
            "row_pitch": 2.70,
            "tier_rise": 0.32,
            "aisle_gap": 2.40,
            "ceiling_height": 16.0,
            "screen_width": 24.0,
            "screen_height": 11.2,
        },
        "screen_type": {
            "type": "boutique_small_flat",
            "name": "Boutique small flat screen",
            "aspect_ratio": 2.14,
            "is_curved": False,
            "has_projector_beam": True,
            "finish": "matte_white",
            "bezel": {"width": 0.35, "color": "#2a1a12", "has_frame": True}
        },
        "description": "Intimate boutique lounge featuring fluted velvet sofas and club ambiance."
    },
    "balcony": {
        "id": "balcony",
        "name": "Grand Curved Hall with Balcony",
        "label": "Grand Balcony Auditorium",
        "target_seats": (420, 560),
        "typical_seats": 520,
        "arrangement": "balcony_two_tier",
        "real_world": {
            "seat_width_m": 0.54,
            "row_pitch_m": 1.05,
            "rake_step_m": 0.20,
            "aisle_width_m": 1.30,
            "ceiling_height_m": 14.0,
            "screen_width_m": 22.0,
            "screen_height_m": 9.8,
        },
        "scene_units": {
            "seat_pitch": 1.24,
            "row_pitch": 2.10,
            "tier_rise": 0.40,
            "aisle_gap": 2.60,
            "ceiling_height": 28.0,
            "screen_width": 44.0,
            "screen_height": 19.6,
        },
        "screen_type": {
            "type": "large_curved",
            "name": "Large curved screen",
            "aspect_ratio": 2.24,
            "is_curved": True,
            "curve_radius_m": 32.0,
            "has_projector_beam": True,
            "finish": "matte_white",
            "bezel": {"width": 0.25, "color": "#15101a", "has_frame": True}
        },
        "palette": {
            "fabric_primary": "#66111f",
            "fabric_secondary": "#7a1526",
            "wall_color": "#2b161c",
            "panel_color": "#381c24",
            "slat_color": "#221116",
            "ceiling_color": "#0c0b0e",
            "cove_color": "#fef08a",
            "skirting_color": "#f59e0b",
            "carpet_color": "#181215",
            "runner_color": "#26141a",
            "trim_color": "#d4af37",
            "stage_lip_color": "#111114",
        },
        "description": "Curved stadium seating with real balcony level, deep burgundy-brown wall panels, dark ceiling with lighting trusses, black stage apron, and curved screen."
    }
}

# Alias for backward compatibility
THEATRE_TYPES["dolby_atmos_4dx"] = THEATRE_TYPES["motion_seat"]


def get_theatre_type_definition(type_or_screen: str = "", total_seats: int = 0) -> dict:
    norm = (type_or_screen or "").lower()
    if norm == "compact" or total_seats == 100 or "interactive" in norm:
        return THEATRE_TYPES["compact"]
    if norm in ("motion_seat", "dolby_atmos_4dx") or "motion" in norm:
        return THEATRE_TYPES["motion_seat"]
    if norm in THEATRE_TYPES:
        return THEATRE_TYPES[norm]
    if "balcony" in norm or total_seats >= 600:
        return THEATRE_TYPES["balcony"]
    if "flagship" in norm or ("imax" in norm and total_seats >= 420):
        return THEATRE_TYPES["flagship"]
    if "recliner" in norm or "gold" in norm or "luxe" in norm:
        return THEATRE_TYPES["luxury_recliner"]
    if "boutique" in norm or "salon" in norm or "lounge" in norm:
        return THEATRE_TYPES["boutique"]
    if "large" in norm or total_seats >= 300:
        return THEATRE_TYPES["large"]
    return THEATRE_TYPES["standard"]

