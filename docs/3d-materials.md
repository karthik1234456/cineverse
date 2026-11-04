# CineVerse 3D — Auditorium Material Architecture & Specification

## Overview
The CineVerse 3D auditorium source asset (`cineverse_auditorium_v2.glb`) contains 262 nodes, 261 meshes, and a single shared vertex-colored material (`CineVerse_Vertex_Color_PBR`). To achieve a premium multiplex aesthetic without modifying the underlying geometry, specialized physically-based materials (`MeshStandardMaterial`) are procedurally assigned at runtime by node-name pattern match.

## Runtime Material Specification by Node Group

| Node Name Pattern | Architectural Element | Material Class | Base Color (Hex) | Roughness | Metalness | Emissive Color | Emissive Intensity | Notes |
|---|---|---|---|---|---|---|---|---|
| `seat_[A-J]_[01-10]` | Cinema Recliner Seats | Fabric Velvet | `#78141b` | 0.75 | 0.05 | Category tint / State | Dynamic (0.06 - 0.90) | Cloned per-seat; displays selected, held, booked, and hovered states |
| `room_floor` | Main Floor | Acoustic Carpet | `#131418` | 0.88 | 0.02 | None | 0.0 | Deep charcoal base, soft light absorption |
| `tier_platform_[A-J]` | Seating Tiers | Tier Carpet | `#15161b` | 0.88 | 0.02 | None | 0.0 | Elevates 0.22u per tier row A-J |
| `central_aisle_tread_[A-J]` | Central Aisle Steps | Non-slip Tread | `#1c1e24` | 0.70 | 0.10 | None | 0.0 | Subtle sheen along player walking path |
| `side_aisle_[LR]` | Side Access Aisles | Aisle Carpet | `#14151a` | 0.88 | 0.02 | None | 0.0 | Left and right emergency egress aisles |
| `front_wall`, `back_wall`, `left_wall`, `right_wall` | Perimeter Enclosure | Acoustic Matte Wall | `#171920` | 0.92 | 0.02 | None | 0.0 | Absorbs reflections; prevents glare |
| `acoustic_panel_[LR]_*` | Acoustic Baffles | Fabric Wall Panel | `#1c1e26` | 0.85 | 0.04 | None | 0.0 | Sound dampening geometric baffles |
| `panel_trim_[LR]_*` | Panel Metal Trims | Brushed Metal | `#2d323e` | 0.35 | 0.80 | None | 0.0 | Architectural metallic accents |
| `ceiling` | Ceiling Canopy | Ultra-Matte Dark | `#0c0d11` | 0.95 | 0.00 | None | 0.0 | Hides lighting trusses and HVAC ducting |
| `screen_outer_frame` | Cinema Screen Bezel | Anodized Black Metal | `#08090b` | 0.85 | 0.20 | None | 0.0 | Matte frame surrounding screen |
| `screen_stage_lip` | Stage Lip / Platform | Dark Polymer Lip | `#14161c` | 0.80 | 0.15 | None | 0.0 | Physical barrier in front of screen |
| `speaker_tower_[LR]`, `speaker_driver_*` | Line Array Sound Towers | Industrial Metal | `#181a20` | 0.45 | 0.70 | None | 0.0 | Matte black speaker cabinets and drivers |
| `handrail_*`, `rail_post_*` | Safety Rails | Satin Stainless Steel | `#475569` | 0.30 | 0.85 | None | 0.0 | Realistic specular reflection on rails |
| `aisle_step_light_*`, `aisle_edge_light_*` | Step & Edge Markers | Neon Emissive Strip | `#38bdf8` | 0.30 | 0.00 | `#38bdf8` | 1.20 | Guides patrons along stairs and aisles |
| `wall_sconce_*`, `ceiling_light_*` | Architectural Lights | Warm Downlight Emitter | `#fef3c7` | 0.20 | 0.00 | `#fef3c7` | 1.50 | Warm ambient downlight fixtures |
| `exit_marker_*` | Emergency Exit Signs | Photoluminescent Sign | `#22c55e` | 0.40 | 0.00 | `#22c55e` | 1.50 | Standard illuminated green exit signage |
| `exit_door_*` | Auditorium Egress Doors | Heavy Acoustic Door | `#16181f` | 0.80 | 0.10 | None | 0.0 | Sound-isolated emergency exit doors |

## Seat State Rendering Palette

Rather than rendering translucent proxy box shells that obstruct seats and clip near the camera, seat states are displayed directly on the cloned `MeshStandardMaterial` of each seat mesh:

1. **Available (Natural)**:
   - Base Color: `#78141b` (Velvet Crimson)
   - Roughness: 0.75, Metalness: 0.05
   - Emissive Accent by Category:
     - Front (Rows A–C): `#c9a227` (Warm Gold, intensity 0.08)
     - Prime (Rows D–G): `#3b82f6` (Electric Blue, intensity 0.08)
     - Premier (Rows H–J): `#a855f7` (Royal Purple, intensity 0.08)
2. **Hovered**:
   - Base Color: `#8e151d`
   - Emissive: `#ffffff` (Soft Fresnel Rim, intensity 0.50)
   - Roughness: 0.70
3. **Selected**:
   - Base Color: `#c81e28` (Vivid Crimson)
   - Emissive: `#ff2233` (Cinematic Red, intensity 0.90)
   - Roughness: 0.65
   - Floating Marker: Circular checkmark pill (`✓`) centered above headrest.
4. **Held by Patron**:
   - Base Color: `#b45309` (Amber)
   - Emissive: `#f59e0b` (Pulsing intensity $0.20 - 0.70$ at 3.5 rad/s)
   - Roughness: 0.75
   - Floating Marker: Pulsing amber indicator (`●`).
5. **Booked / Occupied**:
   - Base Color: `#202227` (Dark Charcoal Desaturated)
   - Emissive: `#000000` (Zero emission)
   - Roughness: 0.95
   - Floating Marker: Subtle cross icon (`✕`).

## Screen Shading & Tone Mapping
- Material: `MeshBasicMaterial` with `toneMapped = true`.
- Texture Color Space: `THREE.SRGBColorSpace`.
- ACES Filmic Tone Mapping compresses dynamic highlights so high-luminance titles ("QUANTUM ODYSSEY") and video trailers retain edge definition and gradient contrast without blowing out to pure white ($< 2\%$ pure-white pixels).

