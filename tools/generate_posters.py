import os
import sys
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
from app.seed.seeder import MOVIES_DATA

output_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'posters')
os.makedirs(output_dir, exist_ok=True)

# Palettes corresponding to themes
PALETTES = {
    'quantum_odyssey': ((20, 10, 45), (75, 15, 120), (220, 40, 100)),
    'astra': ((40, 15, 10), (180, 50, 20), (245, 170, 40)),
    'shadow_protocol': ((10, 25, 35), (20, 80, 100), (0, 210, 180)),
    'last_kingdom': ((30, 20, 15), (100, 40, 20), (200, 140, 60)),
    'monsoon': ((15, 30, 40), (35, 90, 110), (120, 200, 220)),
    'solaris_fleet': ((15, 15, 35), (45, 35, 115), (240, 90, 60)),
    'western_ghats': ((15, 35, 20), (35, 95, 45), (140, 200, 80)),
    'midnight_comedy': ((35, 15, 40), (120, 30, 90), (240, 120, 160)),
    'neon_metropolis': ((15, 10, 35), (90, 20, 110), (0, 220, 240)),
    'forest_spirits': ((20, 35, 25), (40, 110, 70), (160, 225, 140)),
    'chakravyuh': ((35, 15, 15), (120, 30, 30), (230, 120, 40)),
    'inferno': ((40, 10, 10), (140, 30, 20), (250, 120, 20)),
}

def draw_gradient(draw, width, height, c1, c2, c3):
    for y in range(height):
        factor = y / height
        if factor < 0.5:
            f = factor * 2.0
            r = int(c1[0] * (1 - f) + c2[0] * f)
            g = int(c1[1] * (1 - f) + c2[1] * f)
            b = int(c1[2] * (1 - f) + c2[2] * f)
        else:
            f = (factor - 0.5) * 2.0
            r = int(c2[0] * (1 - f) + c3[0] * f)
            g = int(c2[1] * (1 - f) + c3[1] * f)
            b = int(c2[2] * (1 - f) + c3[2] * f)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

for m in MOVIES_DATA:
    slug = m['slug']
    title = m['title']
    palette_key = slug.replace('-', '_').split('_')[0]
    for k in PALETTES:
        if k in slug.replace('-', '_'):
            palette_key = k
            break
    c1, c2, c3 = PALETTES.get(palette_key, ((20, 15, 30), (80, 30, 70), (200, 60, 60)))

    # 1. Poster (600x900)
    p_path = m.get('poster_url', '').lstrip('/')
    if p_path:
        full_p_path = os.path.join(output_dir, os.path.basename(p_path))
        if not os.path.exists(full_p_path):
            img = Image.new('RGB', (600, 900))
            draw = ImageDraw.Draw(img)
            draw_gradient(draw, 600, 900, c1, c2, c3)
            # Decorative elements
            draw.rectangle([30, 30, 570, 870], outline=(255, 255, 255, 60), width=2)
            # Text placeholder
            draw.text((50, 720), title[:26], fill=(255, 255, 255))
            if len(title) > 26:
                draw.text((50, 755), title[26:55], fill=(255, 255, 255))
            draw.text((50, 810), f"{' · '.join(m['genres'])}", fill=(240, 240, 240))
            draw.text((50, 840), f"★ {m['rating_avg']}  |  {m['certificate']}  |  {m['duration_minutes']}m", fill=(255, 215, 0))
            img.save(full_p_path, quality=90)
            print(f"Created poster: {full_p_path}")

    # 2. Banner (1920x800)
    b_path = m.get('banner_url', '').lstrip('/')
    if b_path:
        full_b_path = os.path.join(output_dir, os.path.basename(b_path))
        if not os.path.exists(full_b_path):
            img = Image.new('RGB', (1920, 800))
            draw = ImageDraw.Draw(img)
            draw_gradient(draw, 1920, 800, c1, c2, c3)
            draw.text((120, 520), title, fill=(255, 255, 255))
            draw.text((120, 580), f"{' · '.join(m['genres'])}  |  ★ {m['rating_avg']}", fill=(255, 215, 0))
            img.save(full_b_path, quality=90)
            print(f"Created banner: {full_b_path}")

print("Posters generation complete!")

