# 3D Cinema Seat Assets & Rendering System

## 1. Overview
Phase 2c overhauled the 3D auditorium seating experience in CineVerse. The previous seating used rudimentary low-poly boxes lacking depth, tactile material qualities, and ergonomic detail. The new seating architecture introduces high-fidelity, instanced luxury cinema seats that maintain strict 60 FPS performance budgets while providing authentic fabric sheen, ambient occlusion floor contact, and clear category-based tier styling.

## 2. Asset Specifications & Geometry

| Property | Value | Notes |
| :--- | :--- | :--- |
| **Model Asset** | `frontend/public/models/seat_premium.glb` | Binary glTF 2.0 asset |
| **Generator Script** | `tools/generate_premium_seat.py` | Procedural parametric geometry pipeline |
| **Triangle Count** | **2,016 triangles** | 86.7% reduction from raw unoptimized 15k prototype |
| **Bounding Box** | $X \in [-0.64, 0.64]$, $Y \in [0.0, 2.01]$, $Z \in [-0.46, 0.47]$ | Variance $\le 1\text{ cm}$ relative to original mesh bounds |
| **Structural Features** | Bevelled seat cushion, ergonomic curved backrest, padded armrests with cupholders, steel pedestal base | Built specifically to prevent aisle impingement or sightline clipping |

## 3. Materials & Visual Realism
- **Cushion & Backrest Fabric**: Velvet/fabric response simulated via custom roughness/metalness parameters (`roughness: 0.62`, `metalness: 0.08`, `clearcoat: 0.15`). Light from the theatre screen grazes seat edges realistically without blown-out specular highlights.
- **Armrests & Trim**: Polished satin polymer with drink cupholders (`roughness: 0.35`, `metalness: 0.25`).
- **Base Pedestal**: Matte architectural charcoal steel (`roughness: 0.70`, `metalness: 0.85`).
- **Ambient Occlusion Contact Shadows**: Every seat features an elliptical radial gradient shadow disc ($r=0.68\text{m}$, opacity 0.55) anchored to the floor beneath its base. This grounds the seat visually and eliminates the appearance of floating geometry without the performance penalty of dynamic shadow maps.

## 4. Authentic Category Coloring
Seat fabrics reflect their seating tier to allow patrons to immediately distinguish ticket classes:
- **Premier (Rows I-J)**: Deep Ruby Red (`#9F1239` / `0x9F1239`)
- **Prime (Rows C-H)**: Royal Blue (`#1E40AF` / `0x1E40AF`)
- **Front (Rows A-B)**: Warm Amber Brown (`#8D5B28` / `0x8D5B28`)

## 5. POV Seated Mode Visibility
When a user clicks "Sit Here" or switches to POV view (`mode === 'seated'`):
- The active seat's mesh is automatically hidden (`visible = false`) so the patron's eye-level camera (positioned at $Y=1.15\text{m}$ above the seat) has an unobstructed view of the screen without clipping the chair's headrest.
- Upon standing up (`mode === 'overview'` or `'walk'`), the seat mesh immediately restores visibility.

## 6. Original Asset Fallback
For backward compatibility, debugging, and benchmarking, adding `?seats=original` to any 3D auditorium URL restores the original low-poly auditorium seats instantly.
- Example: `/cinemas/1/auditorium/1?showtime=1&mode=3d&seats=original`

