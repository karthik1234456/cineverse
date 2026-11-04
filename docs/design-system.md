# CineVerse Design System: Simple, Friendly, Light & Colourful

## 1. Principles & Design Philosophy
CineVerse shifted in Phase 2c from dark, cluttered, near-black aesthetics to a warm, inviting, light, and vibrant aesthetic. Cinema is joyous, communal, and celebratory. The design system prioritizes:
1. **Uncompromising Legibility**: Generous typography with body copy at 18px and absolutely zero visible text smaller than 14px.
2. **Warmth & Energy**: Warm ivory paper backgrounds, crisp white floating cards, and jewel-tone gradient headers.
3. **Simplicity Budget**: Strict cognitive constraints to prevent information overload (max 6 header items, 4 mobile nav items, 3 homepage rows, 3 booking steps, max 4 clicks from landing to seats).
4. **Honest & Direct Feedback**: Clear seat pricing upon hover/touch without obfuscation.

---

## 2. Colour Palette & Tokens

### Core Neutral Surfaces
- **App Canvas Background**: `#FFF8F1` (Warm Ivory / Cream)
- **Elevated Card Surface**: `#FFFFFF` (Pure White)
- **Subtle Surface Tint**: `#FAF6F0` (Alabaster / Light Linen)
- **Peach Highlight Tint**: `#FDEBD8` (Soft Warm Peach)
- **Structural Borders**: `#E6DCD2` (Warm Sand Grey)
- **High-Contrast Text**: `#1B1320` (Deep Plum-Black, 13.8:1 contrast on ivory)
- **Secondary/Muted Text**: `#4A4056` (Slate Plum, 5.2:1 contrast on white)

### Primary & Accent Colours
- **Primary Brand Red**: `#C8102E` (Cinema Crimson)
  - Hover: `#A60D26`
  - Active: `#8B0A20`
- **Gold Accent**: `#F2A900` (Cinema Marquee Gold — ratings, premium badges)
- **Teal Accent**: `#0E8F8A` (Deep Teal — experiential highlights, IMAX/4DX)
- **Emerald Affirmation**: `#059669` (Available states, confirmed admissions)
- **Amber Attention**: `#D97706` (Held seats, fast-filling showtimes)

### Rich Gradient Hero Bands
- **Burgundy-Magenta Hero**: `linear-gradient(135deg, #7A0F2E 0%, #C2185B 100%)`
- **Indigo-Violet Hero**: `linear-gradient(135deg, #2B1B6B 0%, #5B3FD0 100%)`
- **Teal-Emerald Hero**: `linear-gradient(135deg, #0B6E6A 0%, #12A594 100%)`

### Seating Tier Categories
- **Premier (Rows I-J)**: `#9F1239` (Ruby Red)
- **Prime (Rows C-H)**: `#1E40AF` (Royal Blue)
- **Front (Rows A-B)**: `#8D5B28` (Warm Amber Brown)

---

## 3. Typography Scale

All text styles are explicitly configured in `tailwind.config.ts` to prevent microscopic text:

| Level | Size | Line Height | Usage |
| :--- | :--- | :--- | :--- |
| **Minimum (`text-xs`)** | **14px** (0.875rem) | 1.25rem | Microcopy, badges, date strip day names, keyboard hints |
| **Small (`text-sm`)** | **15px** (0.9375rem) | 1.375rem | Metadata, secondary labels, filter pills |
| **Body (`text-base`)** | **18px** (1.125rem) | 1.8rem (1.6) | Primary readable body text, form input labels |
| **Heading 3 (`text-xl`)** | **22px - 24px** | 2.0rem | Section headers, modal titles, cinema group cards |
| **Heading 2 (`text-3xl`)** | **30px - 34px** | 2.375rem | Movie titles, major section banners |
| **Heading 1 (`text-5xl`)** | **40px - 48px** | 3.0rem - 3.5rem | Hero headlines, landing display titles |
| **HUD Prices** | **18px - 24px (Bold)** | - | Seat hover tooltip price, checkout grand total |

---

## 4. Components & Interactive Target Budgets

- **Primary Buttons**: Exactly **1 primary button** per screen. Min height $48\text{px}$, padding $16\text{px}\times 24\text{px}$, bold text, rounded 12px-16px.
- **Form Inputs**: Min height $48\text{px}$, border `#E6DCD2`, background `#FFFFFF`, focus ring 2px crimson.
- **Touch Targets**: Minimum bounding box $48\times 48\text{px}$ with at least $8\text{px}$ separation between adjacent interactive elements.
- **Card Radius**: `rounded-2xl` (16px) or `rounded-3xl` (24px) with soft elevation `0 4px 16px rgba(27, 19, 32, 0.06)`.

---

## 5. Simplicity Budget Checklist

- [x] **Desktop Header**: Max 6 interactive items (Logo, City Selector, Search, Movies, Cinemas, User/Sign In).
- [x] **Mobile Bottom Navigation**: 4 clear icons (Home, Movies, Cinemas, Profile).
- [x] **Landing Page Structure**: Max 3 distinct sections (Hero Showcase, Now Showing with format chips, Coming Soon).
- [x] **Clicks to Seats**: Exactly 2 clicks from Home to 3D/2D Seat Selection (Max allowable: 4).
- [x] **Numbered 3-Step Flow**:
  1. `1. Show` (Selected showtime)
  2. `2. Seats` (Interactive seat map & tier selection)
  3. `3. Pay` (Razorpay payment & instant QR generation)
- [x] **Quick Booking**: "Pick the best seats for me" shortcut option in 2D map.
