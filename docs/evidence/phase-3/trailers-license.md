# Phase 3: Trailer Media Asset Licensing & Attribution

All video media assets seeded and served for CineVerse trailers comply strictly with open-licensing mandates (Creative Commons Attribution 3.0 / 4.0), ensuring 100% testable local playback without third-party CDN or copyright constraints.

---

## 1. Asset Inventory & Licences

| Asset Path | Movie Title | Source Origin | Licence | Copyright / Attribution Notice |
| :--- | :--- | :--- | :--- | :--- |
| `/trailers/quantum_odyssey.webm` | **Quantum Odyssey: Beyond the Singularity** | Blender Open Movie Project *Tears of Steel* | **CC-BY 3.0** | (CC) Blender Foundation \| mango.blender.org |
| `/trailers/astra.webm` | **Astra: Chronicles of the Celestial Throne** | Blender Open Movie Project *Sintel* | **CC-BY 3.0** | (CC) Blender Foundation \| durian.blender.org |
| `/trailers/shadow_protocol.ogv` | **Shadow Protocol: Bangalore Drift** | Blender Open Movie Project *Big Buck Bunny* | **CC-BY 3.0** | (CC) Blender Foundation \| peach.blender.org |
| *None* | **Echoes of the Western Ghats** | *N/A (Graceful Fallback Control)* | **N/A** | Displays official film poster with standard distributor notice: *"Trailer not available for this title. The distributor has not yet published an official streaming preview."* |

---

## 2. Compliance & Verification
- **Zero Third-Party Leaks**: All direct assets are served directly from the CineVerse self-hosted static media directory (`frontend/public/trailers/`).
- **No Insecure Third-Party Scripts**: No tracking cookies, third-party analytics, or external trackers are injected into playback frames.
- **Graceful Fallback**: Titles without verified trailer records render an accessible poster-first fallback banner preventing broken iframe/video errors.

