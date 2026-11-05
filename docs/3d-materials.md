# CineVerse 3D Theatre Materials Specification

This document details the physically-based runtime materials (PBR) assigned to the CineVerse auditorium GLB node groups across the three selectable visual looks (**A: Royal Burgundy and Gold**, **B: Warm Walnut and Cream**, and **C: Midnight Indigo and Teal**).

---

## 1. Material Node Groups Mapping

| GLB Mesh / Group Name Pattern | Architectural Purpose | Material Class | Key PBR Properties |
| :--- | :--- | :--- | :--- |
| `seat_*` / `mesh_*` | Audience luxury cinema seating | `MeshStandardMaterial` | Roughness: `0.65–0.72`, Metalness: `0.04`, category-coded color with soft sheen |
| `room_floor` | Auditorium aisle & auditorium floor | `MeshStandardMaterial` | Roughness: `0.85`, Metalness: `0.02`, woven carpet texture with dampening |
| `tier_platform_*`, `side_aisle_*` | Tiered risers / platform fascias | `MeshStandardMaterial` | Roughness: `0.85`, Metalness: `0.02`, matching riser step color |
| `central_aisle_tread_*` | Central illuminated stairway treads | `MeshStandardMaterial` | Roughness: `0.70`, Metalness: `0.08`, slip-resistant finish |
| `*_wall` | Main acoustic structural walls | `MeshStandardMaterial` | Roughness: `0.90`, Metalness: `0.02`, warm matte finish with high diffusion |
| `acoustic_panel_*` | Specialized sound diffusion panels | `MeshStandardMaterial` | Roughness: `0.82`, Metalness: `0.04`, architectural fabric finish |
| `panel_trim_*` | Decorative architectural wall moulding | `MeshStandardMaterial` | Roughness: `0.35`, Metalness: `0.80`, reflective metallic trim (Gold / Bronze / Silver) |
| `ceiling` | Acoustic coffered ceiling slab | `MeshStandardMaterial` | Roughness: `0.95`, Metalness: `0.00`, non-reflective matte finish |
| `screen_outer_frame` | Shadowbox proscenium screen frame | `MeshStandardMaterial` | Roughness: `0.88`, Metalness: `0.15`, deep absorbing matte border |
| `screen_stage_lip` | Proscenium stage floor beneath screen | `MeshStandardMaterial` | Roughness: `0.80`, Metalness: `0.10`, dark non-reflective apron |
| `speaker_*` | Surround acoustic horn enclosures | `MeshStandardMaterial` | Roughness: `0.45`, Metalness: `0.70`, textured dark metal enclosure |
| `handrail_*`, `rail_post_*` | Safety handrails along central/side aisles | `MeshStandardMaterial` | Roughness: `0.30`, Metalness: `0.85`, satin brass (Look A), bronze (Look B), steel (Look C) |
| `wall_sconce_*`, `ceiling_light_*` | Decorative architectural lighting fixtures | `MeshStandardMaterial` | Emissive: `1.50`, Roughness: `0.20`, warm diffused lantern glow |
| `aisle_step_light_*`, `aisle_edge_light_*`| Floor tier low-level path indicators | `MeshStandardMaterial` | Emissive: `1.40`, Roughness: `0.30`, amber / gold / teal step glow |
| `exit_marker_*` | Emergency statutory exit indicators | `MeshStandardMaterial` | Emissive: `1.50`, Color: `#22c55e`, emerald green |

---

## 2. Visual Looks Comparison

### Look A: Royal Burgundy & Gold (Default)
- **Concept:** Grand heritage luxury cinema.
- **Auditorium Walls:** Deep burgundy walls (`#5C2230`) with rich wine acoustic panels (`#7A1F33`) and satin gold trim (`#D4AF37`).
- **Seats:** Velvet burgundy (`#9F1239` Premier, `#881337` Prime, `#7C2D12` Front) with gold highlights.
- **Aisle Lighting:** Warm amber / gold step lighting (`#FBBF24`).

### Look B: Warm Walnut & Cream
- **Concept:** Contemporary boutique screening room.
- **Auditorium Walls:** Deep walnut panels (`#4D3326`) with cream acoustic fabric (`#D6C8B4`) and warm walnut moulding (`#8C5E3C`).
- **Seats:** Rust-red and terracotta leather (`#9A3412` Premier, `#C2410C` Prime, `#854D0E` Front).
- **Aisle Lighting:** Warm sunset orange step lighting (`#F97316`).

### Look C: Midnight Indigo & Teal
- **Concept:** Futuristic IMAX-inspired laser auditorium.
- **Auditorium Walls:** Midnight slate indigo (`#1E293B`) with vibrant teal acoustic diffusion fins (`#0F766E`) and brushed silver trim (`#94A3B8`).
- **Seats:** Sapphire and royal navy (`#1E40AF` Premier, `#2563EB` Prime, `#0D9488` Petrol Teal).
- **Aisle Lighting:** Cool cyan and sky blue step lighting (`#38BDF8`).

---

## 3. Seat In-Situ State Representation

In accordance with Phase 2d / 2c guidelines, state markers (orange dot badges, "x" cubes) have been removed from the 3D scene in favor of integrated in-seat visual states:
- **Available:** Rich category-specific velvet color (Premier ruby, Prime deep claret, Front warm amber-brown).
- **Selected:** Vivid high-contrast crimson (`#DC2626`) with soft glowing emissive accent (`#EF4444`) and subtle checkmark badge.
- **Held by Patron:** Muted warm amber (`#B45309`) with low-frequency breathing pulse (`emissive: #F59E0B`).
- **Booked (Sold Out):** Neutral desaturated dark charcoal (`#374151`) with zero emissive output, signaling non-interactivity.
