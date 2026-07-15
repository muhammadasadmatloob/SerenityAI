import os
import math
from PIL import Image, ImageDraw, ImageFont

def create_icons():
    # Define sizes
    sizes = {
        "mdpi": 48,
        "hdpi": 72,
        "xhdpi": 96,
        "xxhdpi": 144,
        "xxxhdpi": 192
    }
    
    # Adaptive icon foreground is typically 108x108 with 72x72 safe zone for mdpi.
    # We will generate a base image of 1024x1024, then resize.
    # The foreground should have a transparent background.
    base_size = 1024
    
    # We will draw a stylized heart-pulse logo or a calming abstract shape.
    # Let's draw a nice clean white Lotus or wave on a transparent background for foreground.
    # Let's make the logo a stylized "S" or a heart/wave.
    # User wanted something that "represents app", which is a therapy app (SerenityAI).
    fg = Image.new('RGBA', (base_size, base_size), (255, 255, 255, 0))
    d = ImageDraw.Draw(fg)
    
    # Draw a stylized Lotus/Wave representing Serenity
    # Just draw a few thick overlapping circles/arcs in white
    color = (255, 255, 255, 255)
    
    # Central circle
    d.ellipse((362, 362, 662, 662), outline=color, width=40)
    
    # Left petal
    d.arc((162, 362, 562, 762), start=180, end=360, fill=color, width=40)
    
    # Right petal
    d.arc((462, 362, 862, 762), start=180, end=360, fill=color, width=40)

    # A dot in the middle
    d.ellipse((482, 482, 542, 542), fill=color)

    # We also need a full legacy icon (background + foreground)
    bg_color = (128, 140, 234, 255) # #808CEA
    
    # Generate for all sizes
    base_dir = r"d:\dha suffa\FYP PROJECT\SerenityAI\Frontend\android\app\src\main\res"
    
    for dpi, size in sizes.items():
        out_dir = os.path.join(base_dir, f"mipmap-{dpi}")
        os.makedirs(out_dir, exist_ok=True)
        
        # Adaptive foreground
        # Adaptive foreground needs to be sized correctly: for mdpi it's 108x108, hdpi 162x162, etc.
        # Wait, the adaptive mask sizes: mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432
        adaptive_size = int(size * (108 / 48))
        fg_resized = fg.resize((adaptive_size, adaptive_size), Image.Resampling.LANCZOS)
        fg_resized.save(os.path.join(out_dir, "ic_launcher_foreground.png"))
        
        # Legacy square icon
        legacy = Image.new('RGBA', (size, size), bg_color)
        fg_normal = fg.resize((size, size), Image.Resampling.LANCZOS)
        # paste foreground onto legacy
        legacy.paste(fg_normal, (0, 0), fg_normal)
        legacy.save(os.path.join(out_dir, "ic_launcher.png"))
        
        # Legacy round icon
        legacy_round = Image.new('RGBA', (size, size), (255, 255, 255, 0))
        d_round = ImageDraw.Draw(legacy_round)
        d_round.ellipse((0, 0, size, size), fill=bg_color)
        legacy_round.paste(fg_normal, (0, 0), fg_normal)
        legacy_round.save(os.path.join(out_dir, "ic_launcher_round.png"))

if __name__ == "__main__":
    create_icons()
    print("Icons generated successfully!")
