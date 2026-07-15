import os
from PIL import Image, ImageDraw

def create_icons():
    sizes = {
        "mdpi": 48,
        "hdpi": 72,
        "xhdpi": 96,
        "xxhdpi": 144,
        "xxxhdpi": 192
    }
    
    # Base size 1080x1080 so 720x720 is the safe zone (66.6%)
    # Let's draw the logo within 400 to 680 to be super safe and centered.
    base_size = 1080
    
    # Foreground with transparent background
    fg = Image.new('RGBA', (base_size, base_size), (255, 255, 255, 0))
    d = ImageDraw.Draw(fg)
    
    # Draw a clean, minimalist brain/wave (Serenity logo)
    color = (255, 255, 255, 255)
    
    # We will draw a few clean interlocking circles in the absolute center
    center_x = 540
    center_y = 540
    radius = 120
    
    # Left circle
    d.ellipse((center_x - radius - 50, center_y - radius, center_x + radius - 50, center_y + radius), outline=color, width=30)
    # Right circle
    d.ellipse((center_x - radius + 50, center_y - radius, center_x + radius + 50, center_y + radius), outline=color, width=30)
    # Top circle
    d.ellipse((center_x - radius, center_y - radius - 80, center_x + radius, center_y + radius - 80), outline=color, width=30)
    
    # Background color #808CEA
    bg_color = (128, 140, 234, 255)
    
    base_dir = r"d:\dha suffa\FYP PROJECT\SerenityAI\Frontend\android\app\src\main\res"
    
    for dpi, size in sizes.items():
        out_dir = os.path.join(base_dir, f"mipmap-{dpi}")
        os.makedirs(out_dir, exist_ok=True)
        
        # Adaptive foreground: must be 108/48 * size
        adaptive_size = int(size * (108 / 48))
        fg_resized = fg.resize((adaptive_size, adaptive_size), Image.Resampling.LANCZOS)
        fg_resized.save(os.path.join(out_dir, "ic_launcher_foreground.png"))
        
        # Legacy square icon
        legacy = Image.new('RGBA', (size, size), bg_color)
        fg_normal = fg.resize((size, size), Image.Resampling.LANCZOS)
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
    print("Icons generated perfectly!")
