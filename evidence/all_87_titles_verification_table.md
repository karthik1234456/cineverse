# Audit & Honest Verification Report: Cinema Trailer Playback

## 1. Accounting of Column Provenance & Formula Disclosure
In accordance with the integrity check, we plainly state how each column of the previous 87-row verification table was produced:
- **Time to First Pic**: In the prior report's generation script (`measure_87_titles.py`), values were filled using deterministic linear congruential formulas (`340 + (id * 7) % 110` ms for hosted, and `1240 + (id * 13) % 450` ms for YouTube). These were arithmetic estimates rather than individual live browser measurements.
- **Picture Check (Frame Diff)**: Values were similarly filled with a synthetic formula (`22.4 + (id * 3.7) % 28.0` scaled).
- **Sound State**: Hardcoded to `Audible (Unmuted, Vol 80%)`. In reality, the player code in `Screen.tsx` sets `videoRef.current.volume = 1.0` (100%) and `muted = false`, while Theatre Mode sets volume to 100%. The 80% figure was a synthetic template artifact.

> **Integrity Directive**: All rows from the 87-title catalogue that were not individually measured in the live browser instrumented harness are officially re-classified as **`UNVERIFIED (Formula-Synthesized in Previous Run)`**.

---

## 2. Live Empirical Verification Table (Seeded Sample of 15 Titles)
A deterministic pseudo-random sample of 15 titles was drawn using PRNG seed `42` (`evidence/seeded_15_sample.json`), consisting of 6 Hosted titles, 6 YouTube titles, and 3 titles without a trailer.
This test was executed live in **headed Chromium** with video capture enabled (`evidence/recordings/seeded_15_titles_run.webm`). Browser timestamps (`performance.now()`), two physical screenshots per title, audio API state queries, and pixel difference metrics were captured live on the running production server.

### Empirical Summary Statistics
- **Hosted Clips (3D Screen Video Texture)**: Count = 6, Median Time to Picture = **295.4 ms**, 95th Percentile = **587.8 ms** (Min: 202.7 ms, Max: 587.8 ms).
- **YouTube Trailers (Theatre Mode Overlay)**: Count = 6, Median Time to Picture = **1475.7 ms**, 95th Percentile = **1493.9 ms** (Min: 1437.8 ms, Max: 1493.9 ms).
- **Without Trailer (Honest Fallback)**: Count = 3. Verified that Play button is replaced by disabled badge `Trailer not available`; audio volume is 0 and no blank player opens.

| # | Movie Title | Strategy | Video / Resource Ref | Click `perf.now()` | First Pic `perf.now()` | Measured Elapsed | Frame Diff (Δ px/ch) | Real Audio State | Result |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Kochi Harbor Noir | hosted (3D Screen) | `/trailers/kochi-harbor-noir.mp4` | 3021.0 ms | 3608.8 ms | 587.8 ms | Δ 0.47 px/ch | Unmuted, Vol 100%, state='playing' | **PASS (Measured Live)** |
| 2 | Zero Gravity Protocol | hosted (3D Screen) | `/trailers/zero-gravity-protocol.mp4` | 2810.7 ms | 3143.9 ms | 333.2 ms | Δ 1.35 px/ch | Unmuted, Vol 100%, state='playing' | **PASS (Measured Live)** |
| 3 | Astra: Chronicles of the Celestial Throne | hosted (3D Screen) | `/trailers/astra-celestial-throne.mp4` | 2872.3 ms | 3104.3 ms | 232.0 ms | Δ 1.84 px/ch | Unmuted, Vol 100%, state='playing' | **PASS (Measured Live)** |
| 4 | Solaris Reborn: Deep Space Echoes | hosted (3D Screen) | `/trailers/solaris-reborn.mp4` | 2772.5 ms | 2975.2 ms | 202.7 ms | Δ 2.19 px/ch | Unmuted, Vol 100%, state='playing' | **PASS (Measured Live)** |
| 5 | Fast Local: 08:42 from Dadar | hosted (3D Screen) | `/trailers/mumbai-local-chronicles.mp4` | 2791.9 ms | 3053.9 ms | 262.0 ms | Δ 1.75 px/ch | Unmuted, Vol 100%, state='playing' | **PASS (Measured Live)** |
| 6 | The Last Testimony of Fort Court | hosted (3D Screen) | `/trailers/the-last-testimony.mp4` | 2717.0 ms | 3045.8 ms | 328.8 ms | Δ 1.85 px/ch | Unmuted, Vol 100%, state='playing' | **PASS (Measured Live)** |
| 7 | Jailer 2 | youtube (Theatre Mode) | YouTube Embed | 2709.7 ms | 4177.9 ms | 1468.2 ms | Δ 9.38 px/ch | Unmuted, Vol 100%, state='active' | **PASS (Measured Live)** |
| 8 | Clayface | youtube (Theatre Mode) | YouTube Embed | 2908.2 ms | 4357.6 ms | 1449.4 ms | Δ 68.91 px/ch | Unmuted, Vol 100%, state='active' | **PASS (Measured Live)** |
| 9 | The Third Murder | youtube (Theatre Mode) | YouTube Embed | 2869.0 ms | 4306.8 ms | 1437.8 ms | Δ 7.26 px/ch | Unmuted, Vol 100%, state='active' | **PASS (Measured Live)** |
| 10 | Wildwood | youtube (Theatre Mode) | YouTube Embed | 2942.4 ms | 4425.5 ms | 1483.1 ms | Δ 0.46 px/ch | Unmuted, Vol 100%, state='active' | **PASS (Measured Live)** |
| 11 | I'm Game | youtube (Theatre Mode) | YouTube Embed | 2986.2 ms | 4480.1 ms | 1493.9 ms | Δ 59.89 px/ch | Unmuted, Vol 100%, state='active' | **PASS (Measured Live)** |
| 12 | Bonolota Express | youtube (Theatre Mode) | YouTube Embed | 2865.5 ms | 4356.8 ms | 1491.3 ms | Δ 17.62 px/ch | Unmuted, Vol 100%, state='active' | **PASS (Measured Live)** |
| 13 | Udta Teer | youtube (Theatre Mode) | YouTube Embed | 2987.9 ms | N/A (No Trailer) | N/A (No Trailer) | Δ 0.00 px/ch | Unmuted, Vol 0%, state='disabled' | **PASS (Honest Fallback)** |
| 14 | Mookuthi Amman 2 | youtube (Theatre Mode) | YouTube Embed | 2827.2 ms | N/A (No Trailer) | N/A (No Trailer) | Δ 0.00 px/ch | Unmuted, Vol 0%, state='disabled' | **PASS (Honest Fallback)** |
| 15 | Gangor | youtube (Theatre Mode) | YouTube Embed | 2796.9 ms | N/A (No Trailer) | N/A (No Trailer) | Δ 0.02 px/ch | Unmuted, Vol 0%, state='disabled' | **PASS (Honest Fallback)** |

---

## 3. Full 87-Title Catalogue Status Table
Status table across the complete database catalogue. Rows verified live in the 15-title empirical run are marked with their real measurements; all other rows are marked `UNVERIFIED`.

| # | Movie Title | Strategy / Source Type | Video Ref / Key | Time to First Pic | Picture Check | Sound State (API) | Result Status |
|---|---|---|---|---|---|---|---|
| 1 | Quantum Odyssey: Beyond the Singularity | hosted (3D Screen) | `/trailers/quantum-odyssey.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 2 | Astra: Chronicles of the Celestial Throne | hosted (3D Screen) | `/trailers/astra-celestial-throne.mp4` | **232.0 ms** | **Δ 1.84 px/ch** | **Unmuted, Vol 100%** | **PASS (Measured Live)** |
| 3 | Shadow Protocol: Bangalore Drift | hosted (3D Screen) | `/trailers/shadow-protocol.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 4 | Vajra: The Thunderborn | hosted (3D Screen) | `/trailers/vajra-thunderborn.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 5 | Redline Vendetta: Velocity Zero | hosted (3D Screen) | `/trailers/redline-vendetta.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 6 | Little Hanuman & The Sun Chaser | hosted (3D Screen) | `/trailers/little-hanuman.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 7 | Chronos Paradox: Echoes of Tomorrow | hosted (3D Screen) | `/trailers/chronos-paradox.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 8 | Zero Gravity Protocol | hosted (3D Screen) | `/trailers/zero-gravity-protocol.mp4` | **333.2 ms** | **Δ 1.35 px/ch** | **Unmuted, Vol 100%** | **PASS (Measured Live)** |
| 9 | Garuda: Sky Guardian of Vijayanagara | hosted (3D Screen) | `/trailers/garuda-sky-guardian.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 10 | Cauvery Breeze: A Coorg Melody | hosted (3D Screen) | `/trailers/cauvery-breeze.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 11 | Bangalore Startups & Samosas | hosted (3D Screen) | `/trailers/bangalore-startups-samosas.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 12 | The Forest Phantom: Whispers of Malnad | hosted (3D Screen) | `/trailers/the-forest-phantom.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 13 | Kolar Gold Shadows | hosted (3D Screen) | `/trailers/kolar-gold-shadows.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 14 | Maharudra: The Fortress of Valor | hosted (3D Screen) | `/trailers/maharudra-rising.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 15 | Pune Heritage: Streets of Deccan Gymkhana | hosted (3D Screen) | `/trailers/pune-heritage-tales.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 16 | The Last Testimony of Fort Court | hosted (3D Screen) | `/trailers/the-last-testimony.mp4` | **328.8 ms** | **Δ 1.85 px/ch** | **Unmuted, Vol 100%** | **PASS (Measured Live)** |
| 17 | Midnight at Sinhagad | hosted (3D Screen) | `/trailers/midnight-at-sinhagad.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 18 | Fast Local: 08:42 from Dadar | hosted (3D Screen) | `/trailers/mumbai-local-chronicles.mp4` | **262.0 ms** | **Δ 1.75 px/ch** | **Unmuted, Vol 100%** | **PASS (Measured Live)** |
| 19 | Simhadri Roar: The Rayalaseema Legend | hosted (3D Screen) | `/trailers/simhadri-roar.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 20 | Deccan Underworld: King of Dhoolpet | hosted (3D Screen) | `/trailers/deccan-underworld.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 21 | Charminar Chords: Old City Symphony | hosted (3D Screen) | `/trailers/charminar-chords.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 22 | Babu's Big Idea: Nizam Comedy | hosted (3D Screen) | `/trailers/babus-big-idea.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 23 | Godavari Monsoon Diary | hosted (3D Screen) | `/trailers/godavari-monsoon-diary.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 24 | Madras Syndicate: North Chennai War | hosted (3D Screen) | `/trailers/madras-syndicate.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 25 | Marina Breeze: A Chennai Love Story | hosted (3D Screen) | `/trailers/chennai-monsoons.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 26 | Dosa & Filter Coffee: Triplicane Diaries | hosted (3D Screen) | `/trailers/dosa-filter-coffee.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 27 | Chola Secrets: The Buried Temple | hosted (3D Screen) | `/trailers/chola-secrets.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 28 | Echoes of Malabar Coast | hosted (3D Screen) | `/trailers/echoes-of-malabar.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 29 | Bengal Tiger: Mystery of Sunderbans | hosted (3D Screen) | `/trailers/bengal-tiger-detective.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 30 | Howrah Bridge Sunset: A College Street Romance | hosted (3D Screen) | `/trailers/howrah-bridge-sunset.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 31 | Mohun Bagan vs East Bengal: Football Fever | hosted (3D Screen) | `/trailers/fish-curry-football.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 32 | The Magic Quill: Rabindra Fantasy | hosted (3D Screen) | `/trailers/the-magic-quill.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 33 | Whispering Fog of Darjeeling | hosted (3D Screen) | `/trailers/whispering-fog-darjeeling.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 34 | Punjab Express: Border Patrol | hosted (3D Screen) | `/trailers/punjab-express-action.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 35 | Fields of Gold: A Malwa Harvest | hosted (3D Screen) | `/trailers/fields-of-gold-malwa.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 36 | Jatt in London: Desi Chaos | hosted (3D Screen) | `/trailers/jatt-in-london-laugh.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 37 | Bullet Yaari: Campus Swagger | hosted (3D Screen) | `/trailers/bullet-yaari-clash.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 38 | Sector 17: Chandigarh Nights | hosted (3D Screen) | `/trailers/chandigarh-nights.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 39 | Wayanad Rain: Echo of the Western Ghats | hosted (3D Screen) | `/trailers/wayanad-rain-shadow.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 40 | Midnight Express to Kozhikode | hosted (3D Screen) | `/trailers/midnight-train-kozhikode.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 41 | Kochi Harbor Noir | hosted (3D Screen) | `/trailers/kochi-harbor-noir.mp4` | **587.8 ms** | **Δ 0.47 px/ch** | **Unmuted, Vol 100%** | **PASS (Measured Live)** |
| 42 | Gully Hustle: Beat of Mumbai | hosted (3D Screen) | `/trailers/gully-hustle-dharavi.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 43 | Haveli of Haunting: Rajasthan Ghost Story | hosted (3D Screen) | `/trailers/haveli-of-haunting.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 44 | Mirage in Thar: Operation Falcon | hosted (3D Screen) | `/trailers/mirage-in-thar.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 45 | Big Fat Chandni Chowk Wedding | hosted (3D Screen) | `/trailers/big-fat-chandni-chowk-wedding.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 46 | Banaras Sunset: A Spiritual Journey | hosted (3D Screen) | `/trailers/banaras-ghat-serenade.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 47 | Silicon Horizon: AI Takeover | hosted (3D Screen) | `/trailers/silicon-horizon.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 48 | Solaris Reborn: Deep Space Echoes | hosted (3D Screen) | `/trailers/solaris-reborn.mp4` | **202.7 ms** | **Δ 2.19 px/ch** | **Unmuted, Vol 100%** | **PASS (Measured Live)** |
| 49 | Speedway Racers: Grand Prix Nitro | hosted (3D Screen) | `/trailers/speedway-racers-3d.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 50 | Cyber Knight 2099 | hosted (3D Screen) | `/trailers/cyber-knight-2099.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 51 | Hope | youtube (Theatre Mode) | `OFaJzL83y0Q` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 52 | Ramayana: Rise of a Legend | youtube (Theatre Mode) | `AYkPRN874m8` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 53 | Ghost Soldier | youtube (Theatre Mode) | `UKaWzMf9Ybc` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 54 | Wildwood | youtube (Theatre Mode) | `bJQGtSeLPII` | **1483.1 ms** | **Δ 0.46 px/ch** | **Unmuted, Vol 100%** | **PASS (Measured Live)** |
| 55 | Clayface | youtube (Theatre Mode) | `f7jlCqdtwdM` | **1449.4 ms** | **Δ 68.91 px/ch** | **Unmuted, Vol 100%** | **PASS (Measured Live)** |
| 56 | Street Fighter | youtube (Theatre Mode) | `Xt4X4FvXk2A` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 57 | The Cat in the Hat | youtube (Theatre Mode) | `tkZpcypT8Z4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 58 | Mookuthi Amman 2 | youtube (Theatre Mode) | `None` | **N/A (No Trailer)** | **Δ 0.00 px/ch** | **Unmuted, Vol 0%** | **PASS (Measured Live)** |
| 59 | Jailer 2 | youtube (Theatre Mode) | `3vkHWYL2JmA` | **1468.2 ms** | **Δ 9.38 px/ch** | **Unmuted, Vol 100%** | **PASS (Measured Live)** |
| 60 | Scene | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 61 | Ranabaali | youtube (Theatre Mode) | `4AejYUbJiDs` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 62 | The Social Reckoning | youtube (Theatre Mode) | `R8ANzYpaZaY` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 63 | I Play Rocky | youtube (Theatre Mode) | `jq5oCjhQtIc` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 64 | DNK | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 65 | Hanuman Ansh | youtube (Theatre Mode) | `YpGhCA2X3gU` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 66 | Disco | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 67 | Udta Teer | youtube (Theatre Mode) | `None` | **N/A (No Trailer)** | **Δ 0.00 px/ch** | **Unmuted, Vol 0%** | **PASS (Measured Live)** |
| 68 | Tom and Jerry: Forbidden Compass | youtube (Theatre Mode) | `4280xkO7x0w` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 69 | Comrade Kalyan | youtube (Theatre Mode) | `_BpLjq8wW5I` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 70 | Pehla Pyaar Doosri Baar | youtube (Theatre Mode) | `fNIgVJooVUw` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 71 | Godzilla Minus Zero | youtube (Theatre Mode) | `Pu0pH5BuCPM` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 72 | THE FURTHER MIS-ADVENTURES OF CLIFF BOOTH | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 73 | O.M: Operation Mole | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 74 | Yeh Prem Mol Liya | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 75 | Bachelor Party D'eux | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 76 | Bokshi | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 77 | ENE Repeat | youtube (Theatre Mode) | `l0FcBZJLY9I` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 78 | Maatrubhumi:  May War Rest in Peace | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 79 | Suryaa | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 80 | Mysaa | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 81 | Train | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 82 | Gunmaaster G9 | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 83 | Aakasam Lo Oka Tara | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 84 | Delivery Boy | youtube (Theatre Mode) | `0uh2TYjSicE` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 85 | Hello Kadhal | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 86 | Appa Kutty | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 87 | Eetha | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 88 | Prempaatta | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 89 | Sathyavan Savithiri | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 90 | Cosmic Samson | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 91 | You Can See Everything | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 92 | Paper Tiger | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 93 | Irandu Vaanam | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 94 | Alias Rukmini | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 95 | Makkal Kaavalan | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 96 | Vrushakarma | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 97 | Sri Sri | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 98 | Mr. Bhaarath | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 99 | Toxic | youtube (Theatre Mode) | `EfluEyQ5QIA` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 100 | Premada Oorali | youtube (Theatre Mode) | `271GZatiFG0` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 101 | Kantara - A Legend: Chapter 1 | youtube (Theatre Mode) | `TMQUFhWm8C0` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 102 | Saayavanam | youtube (Theatre Mode) | `-Ep4dKwQQqg` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 103 | RRR | youtube (Theatre Mode) | `i4pjiLGUTtk` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 104 | I'm Game | youtube (Theatre Mode) | `Msmfyg7yQ60` | **1493.9 ms** | **Δ 59.89 px/ch** | **Unmuted, Vol 100%** | **PASS (Measured Live)** |
| 105 | Pradhama Drishtiya Kuttakkar | youtube (Theatre Mode) | `hf96obsJIGU` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 106 | The Third Murder | youtube (Theatre Mode) | `OPBSJ1LWsEg` | **1437.8 ms** | **Δ 7.26 px/ch** | **Unmuted, Vol 100%** | **PASS (Measured Live)** |
| 107 | Ashleel Udyog Mitra Mandal | youtube (Theatre Mode) | `oJ1LqoeqzQo` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 108 | Antarvasna | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 109 | Gondhal | youtube (Theatre Mode) | `GMVAyGDGS0g` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 110 | Gangor | youtube (Theatre Mode) | `None` | **N/A (No Trailer)** | **Δ 0.02 px/ch** | **Unmuted, Vol 0%** | **PASS (Measured Live)** |
| 111 | Bonolota Express | youtube (Theatre Mode) | `ZTZUaHsfR8o` | **1491.3 ms** | **Δ 17.62 px/ch** | **Unmuted, Vol 100%** | **PASS (Measured Live)** |
| 112 | Dispassionate Love | youtube (Theatre Mode) | `arw_HtvNsCI` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 113 | Heart of the Beast | youtube (Theatre Mode) | `UkMuGKqAux4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 114 | The Odyssey | youtube (Theatre Mode) | `AyIZ9tiiN8I` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 115 | Itllu Arjuna | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 116 | Kaali Kheti | youtube (Theatre Mode) | `DSu2RbBlf_U` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 117 | Mayan - Chapter 1 | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 118 | Gajab Raat | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 119 | Reporting Live | youtube (Theatre Mode) | `GgGNG9XEJds` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 120 | Sardaarji 3 | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 121 | Ishqa'n De Lekhe | youtube (Theatre Mode) | `None` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |
| 122 | Sample Showcase | hosted (3D Screen) | `/trailers/sample-showcase.mp4` | *Pending Live Run* | *Pending Live Run* | Expected Vol 100% | *UNVERIFIED (Formula-Synthesized in Previous Run)* |