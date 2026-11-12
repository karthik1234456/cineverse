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
        "name": "Standard Cinema Hall",
        "label": "Standard Stadium Hall",
        "target_seats": (180, 260),
        "typical_seats": 224,
        "arrangement": "single_aisle",
        "real_world": {
            "seat_width_m": 0.55,
            "row_pitch_m": 1.00,
            "rake_step_m": 0.18,
            "aisle_width_m": 1.20,
            "ceiling_height_m": 10.0,
            "screen_width_m": 16.0,
            "screen_height_m": 7.4,
        },
        "scene_units": {
            "seat_pitch": 1.10,
            "row_pitch": 2.00,
            "tier_rise": 0.36,
            "aisle_gap": 2.40,
            "ceiling_height": 20.0,
            "screen_width": 32.0,
            "screen_height": 14.8,
        },
        "screen_type": {
            "type": "standard_flat",
            "name": "Standard flat screen",
            "aspect_ratio": 2.16,
            "is_curved": False,
            "has_projector_beam": True,
            "finish": "matte_white",
            "bezel": {"width": 0.30, "color": "#111115", "has_frame": True}
        },
        "description": "Mainstream 14-18 row cinema with a central aisle and clear sightlines."
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
        "name": "IMAX-Style Flagship",
        "label": "IMAX Laser Flagship",
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
            "brand_name": "IMAX",
            "aspect_ratio": 1.85,
            "is_curved": True,
            "curve_radius_m": 28.0,
            "has_projector_beam": True,
            "finish": "matte_white",
            "bezel": {"width": 0.15, "color": "#05070a", "has_frame": True}
        },
        "description": "Colossal 20-row flagship hall with 25m curved screen, curved seating arc, and sweet spot."
    },
    "dolby_atmos_4dx": {
        "id": "dolby_atmos_4dx",
        "name": "Motion-seat Hall",
        "label": "Motion-seat Experience",
        "licensed_name": "Dolby Atmos & 4DX Experience",
        "licensed_label": "4DX Motion Theatre",
        "target_seats": (160, 300),
        "typical_seats": 240,
        "arrangement": "motion_pods",
        "real_world": {
            "seat_width_m": 0.56,
            "row_pitch_m": 1.25,
            "rake_step_m": 0.24,
            "aisle_width_m": 1.25,
            "ceiling_height_m": 11.5,
            "screen_width_m": 18.0,
            "screen_height_m": 9.5,
        },
        "scene_units": {
            "seat_pitch": 1.12,
            "row_pitch": 2.50,
            "tier_rise": 0.48,
            "aisle_gap": 2.50,
            "ceiling_height": 23.0,
            "screen_width": 36.0,
            "screen_height": 19.0,
        },
        "screen_type": {
            "type": "panoramic_wrap",
            "name": "Panoramic wrap screen",
            "brand_name": "ScreenX",
            "aspect_ratio": 1.90,
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
        "features": {
            "motion_seats": True,
            "panoramic_wrap": True,
            "is_4dx": True,
            "dolby_atmos": True
        },
        "description": "Sensory motion-seat theatre with synchronized 2- and 4-seat motion pods, panoramic wrap screen, and atmospheric effect rig."
    },
    "luxury_recliner": {
        "id": "luxury_recliner",
        "name": "Luxe Recliner & Gold Lounge",
        "label": "VIP Recliner Lounge",
        "target_seats": (60, 120),
        "typical_seats": 84,
        "arrangement": "luxury_pairs",
        "real_world": {
            "seat_width_m": 0.95,
            "row_pitch_m": 1.50,
            "rake_step_m": 0.22,
            "aisle_width_m": 1.30,
            "ceiling_height_m": 8.5,
            "screen_width_m": 14.0,
            "screen_height_m": 6.5,
        },
        "scene_units": {
            "seat_pitch": 1.90,
            "row_pitch": 3.00,
            "tier_rise": 0.44,
            "aisle_gap": 2.60,
            "ceiling_height": 17.0,
            "screen_width": 28.0,
            "screen_height": 13.0,
        },
        "screen_type": {
            "type": "premium_direct_view",
            "name": "Premium direct-view screen",
            "aspect_ratio": 2.15,
            "is_curved": False,
            "has_projector_beam": False,
            "finish": "glossy_led",
            "bezel": {"width": 0.08, "color": "#050505", "thin_black": True, "has_frame": True}
        },
        "description": "Ultra-exclusive luxury hall with leather recliner pairs and generous legroom."
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
        "name": "Grand Balcony Auditorium",
        "label": "Grand Balcony Hall",
        "target_seats": (500, 700),
        "typical_seats": 700,
        "arrangement": "balcony_two_tier",
        "real_world": {
            "seat_width_m": 0.55,
            "row_pitch_m": 1.05,
            "rake_step_m": 0.20,
            "aisle_width_m": 1.30,
            "ceiling_height_m": 14.0,
            "screen_width_m": 24.0,
            "screen_height_m": 11.2,
        },
        "scene_units": {
            "seat_pitch": 1.10,
            "row_pitch": 2.10,
            "tier_rise": 0.40,
            "aisle_gap": 2.60,
            "ceiling_height": 28.0,
            "screen_width": 48.0,
            "screen_height": 22.4,
        },
        "screen_type": {
            "type": "large_curved",
            "name": "Large curved screen",
            "aspect_ratio": 2.14,
            "is_curved": True,
            "curve_radius_m": 36.0,
            "has_projector_beam": True,
            "finish": "matte_white",
            "bezel": {"width": 0.25, "color": "#15101a", "has_frame": True}
        },
        "description": "Monumental two-tier auditorium with ground-floor Stalls (460 seats) and upper Balcony (240 seats)."
    }
}


def get_theatre_type_definition(type_or_screen: str = "", total_seats: int = 0) -> dict:
    norm = (type_or_screen or "").lower()
    if norm == "compact" or total_seats == 100 or "interactive" in norm:
        return THEATRE_TYPES["compact"]
    if norm in THEATRE_TYPES:
        return THEATRE_TYPES[norm]
    if "balcony" in norm or total_seats >= 600:
        return THEATRE_TYPES["balcony"]
    if "flagship" in norm or ("imax" in norm and total_seats >= 420):
        return THEATRE_TYPES["flagship"]
    if "4dx" in norm or "atmos" in norm or "motion" in norm:
        return THEATRE_TYPES["dolby_atmos_4dx"]
    if "recliner" in norm or "gold" in norm or "luxe" in norm:
        return THEATRE_TYPES["luxury_recliner"]
    if "boutique" in norm or "salon" in norm or "lounge" in norm:
        return THEATRE_TYPES["boutique"]
    if "large" in norm or total_seats >= 300:
        return THEATRE_TYPES["large"]
    return THEATRE_TYPES["standard"]

