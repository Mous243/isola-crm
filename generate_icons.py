"""
Genera los iconos PWA para ISOLA CRM.
Requiere Pillow: pip install pillow
Ejecutar desde la carpeta isola-crm-web: python generate_icons.py
"""
from PIL import Image, ImageDraw, ImageFont
import os

def make_icon(size):
    img = Image.new('RGB', (size, size), color='#0f172a')
    draw = ImageDraw.Draw(img)

    # Círculo violeta de fondo
    margin = size // 8
    draw.ellipse([margin, margin, size - margin, size - margin], fill='#7c3aed')

    # Texto "IC" centrado
    font_size = size // 3
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", font_size)
    except Exception:
        font = ImageFont.load_default()

    text = "IC"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) // 2 - bbox[0]
    y = (size - th) // 2 - bbox[1]
    draw.text((x, y), text, fill='white', font=font)

    return img

os.makedirs('public', exist_ok=True)
make_icon(192).save('public/icon-192.png')
make_icon(512).save('public/icon-512.png')
print("Iconos generados: public/icon-192.png, public/icon-512.png")
