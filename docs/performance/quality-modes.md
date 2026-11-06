# CineVerse 3D Quality Modes Reference Specification (Phase 2e — Part 5)

**Feature**: Smooth vs. Beautiful Quality Switch  
**Persistence Key**: `localStorage.getItem('cineverse_quality_mode')` (`'smooth'` | `'beautiful'`)  
**Target Route**: `/cinemas/1/auditorium/1?showtime=1&mode=3d`  
**Control Component**: `frontend/components/3d/ViewModeToggle.tsx`  
**State Store**: `frontend/store/useCinemaStore.ts` (`qualityMode`, `setQualityMode`)  

---

## 1. Overview & Motivation

To provide a consistent, responsive experience across low-end mobile devices, integrated laptop GPUs, and high-performance desktop rigs, CineVerse introduces a user-accessible **Smooth vs. Beautiful** rendering quality toggle.

The toggle is available inside the 3D Theatre Settings Popover (`[data-testid="settings-menu-toggle"]` -> `[data-testid="quality-mode-selector"]`).
Switching between modes takes effect **instantly without page reload**, immediately reconfiguring WebGL renderer properties, shadow passes, and canvas sampling.

---

## 2. Technical Comparison Matrix

| Property | Smooth Mode (`'smooth'`) | Beautiful Mode (`'beautiful'`) | Technical Rationale |
| :--- | :--- | :--- | :--- |
| **Target Frame Rate** | Consistent 60 FPS (Interaction) / Idle 0 FPS | Consistent 60 FPS (Interaction) / Idle 0 FPS | Render-on-demand idles both modes when camera is static. |
| **Device Pixel Ratio (DPR)** | Strictly clamped to `1.0` | Dynamically scaled up to `1.5` | Prevents fill-rate bottlenecks on 3x high-DPI smartphone displays. |
| **Ceiling Spot Shadows** | `castShadow = false` | `castShadow = true` (512×512 shadow map) | Eliminates secondary shadow passes over 200k triangles. |
| **Screen Spill Sampling** | Analytical simulation (zero GPU readbacks) | 1×1 GPU downsampled Canvas with `willReadFrequently` | Eliminates PCIe synchronization stalls while preserving ambient color sync. |
| **Contact Shadow Opacity** | `0.22` (light blur) | `0.45` (rich ambient grounding) | Balances ambient occlusion depth against fragment shader overhead. |
| **Internal Store Tier** | `qualityTier = 'low'` | `qualityTier = 'high'` | Provides backward compatibility with Phase 1 tiering. |
| **Primary Goal** | Maximum battery life & silky navigation | Maximum visual fidelity and cinema immersion | Caters to hardware capabilities. |

---

## 3. Visual Comparison & User Experience

### Smooth Mode
- **Visual Presentation**: Crisp, high-contrast auditorium geometry with clean diffuse shading. Floor and seating receive soft ground contact shadowing.
- **Lighting Dynamics**: Ambient room lights and screen spill adjust smoothly via mathematical color transitions without any micro-stutters.
- **Responsiveness**: Immediate camera responsiveness during orbit and first-person walking, even on modest hardware.

### Beautiful Mode
- **Visual Presentation**: Full cinematic depth with dynamic spotlights projecting soft directional shadows behind auditorium seats.
- **Lighting Dynamics**: Screen illumination reflects exact color nuances of current movie frames, casting an atmospheric glow across front-row seating and acoustic wall paneling.
- **Atmosphere**: Rich contact ambient occlusion under every seat row creates deep spatial grounding.

---

## 4. Hardware Recommendations

| User Device Class | Recommended Mode | Expected Performance |
| :--- | :---: | :--- |
| **Mobile Phones (iOS Safari / Android Chrome)** | **Smooth** | Steady 60 FPS touch orbit, low battery drain, cool thermal profile. |
| **Laptops with Integrated Graphics (Intel Iris Xe / AMD Vega)** | **Smooth** | Fluid 60 FPS navigation, instantaneous seat selection. |
| **Dedicated GPUs (NVIDIA RTX / AMD Radeon / Apple Silicon M-Series)**| **Beautiful** | Stunning photorealistic lighting, full resolution, 60+ FPS. |

---

## 5. Persistence & State Architecture

### LocalStorage Contract
- Key: `'cineverse_quality_mode'`
- Values: `'smooth'` | `'beautiful'`
- Fallback: Defaults to `'beautiful'` on desktop systems with hardware acceleration; falls back to `'smooth'` on low-powered mobile user agents.

### Store API
```typescript
interface CinemaStore {
  qualityMode: 'smooth' | 'beautiful';
  setQualityMode: (mode: 'smooth' | 'beautiful') => void;
}
```

When `setQualityMode(mode)` is invoked:
1. The preference is written immediately to `localStorage.setItem('cineverse_quality_mode', mode)`.
2. `qualityTier` is synchronized (`'smooth'` -> `'low'`, `'beautiful'` -> `'high'`).
3. Connected components re-render with updated rendering parameters without unmounting the Three.js Canvas.

---

## 6. Developer Guide: Adding New Quality-Dependent Features

When adding new 3D components, shaders, or lighting elements to CineVerse, always tie expensive effects to `qualityMode`:

```typescript
import { useCinemaStore } from '@/store/useCinemaStore';

export function MyNewTheatreFeature() {
  const qualityMode = useCinemaStore((state) => state.qualityMode);
  const isBeautiful = qualityMode === 'beautiful';

  return (
    <mesh>
      {/* Example: Disable expensive normal maps or shaders in Smooth mode */}
      <meshStandardMaterial
        color="#8B1538"
        roughness={isBeautiful ? 0.4 : 0.8}
        metalness={0.1}
      />
    </mesh>
  );
}
```

