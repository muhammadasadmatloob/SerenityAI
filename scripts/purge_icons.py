import os
import shutil
from PIL import Image, ImageDraw

def purge_and_create_premium_icons():
    # 1. Paths
    frontend_assets_dir = r"d:\dha suffa\FYP PROJECT\SerenityAI\Frontend\assets\images"
    generated_img_path = r"C:\Users\dell5540\.gemini\antigravity\brain\bbda2b3f-d140-4141-9546-a76b2c715741\premium_serenity_icon_1784117432097.png"
    
    if not os.path.exists(generated_img_path):
        print(f"Error: Could not find generated image at {generated_img_path}")
        return

    print("Opening generated AI image...")
    logo = Image.open(generated_img_path).convert("RGBA")
    
    # 2. Create proper adaptive foreground canvas
    # Canvas is 1080x1080, logo is 720x720 (Safe zone)
    base_size = 1080
    safe_size = 720
    bg_color = (8, 27, 41, 255)  # #081B29
    
    fg = Image.new('RGBA', (base_size, base_size), bg_color)
    logo_resized = logo.resize((safe_size, safe_size), Image.Resampling.LANCZOS)
    offset = (base_size - safe_size) // 2
    fg.paste(logo_resized, (offset, offset))
    
    # 3. Overwrite Expo assets
    print("Overwriting Expo fallback assets...")
    # Standard square icon
    legacy_full = logo.resize((1024, 1024), Image.Resampling.LANCZOS)
    legacy_full.save(os.path.join(frontend_assets_dir, "icon.png"))
    legacy_full.save(os.path.join(frontend_assets_dir, "adaptive-icon.png"))
    legacy_full.save(os.path.join(frontend_assets_dir, "splash-icon.png"))
    
    # Android adaptive foreground (Needs transparent or solid colored padding for the mask)
    fg_1024 = fg.resize((1024, 1024), Image.Resampling.LANCZOS)
    fg_1024.save(os.path.join(frontend_assets_dir, "android-icon-foreground.png"))
    
    # 4. Overwrite Android Mipmaps
    print("Overwriting Android mipmaps...")
    sizes = {
        "mdpi": 48,
        "hdpi": 72,
        "xhdpi": 96,
        "xxhdpi": 144,
        "xxxhdpi": 192
    }
    
    base_dir = r"d:\dha suffa\FYP PROJECT\SerenityAI\Frontend\android\app\src\main\res"
    
    for dpi, size in sizes.items():
        out_dir = os.path.join(base_dir, f"mipmap-{dpi}")
        os.makedirs(out_dir, exist_ok=True)
        
        # Adaptive foreground
        adaptive_size = int(size * (108 / 48))
        fg_adaptive = fg.resize((adaptive_size, adaptive_size), Image.Resampling.LANCZOS)
        fg_adaptive.save(os.path.join(out_dir, "ic_launcher_foreground.png"))
        
        # Legacy square
        legacy = logo.resize((size, size), Image.Resampling.LANCZOS)
        legacy.save(os.path.join(out_dir, "ic_launcher.png"))
        
        # Legacy round
        legacy_round = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        mask = Image.new('L', (size, size), 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, size, size), fill=255)
        legacy_round.paste(legacy, (0, 0), mask=mask)
        legacy_round.save(os.path.join(out_dir, "ic_launcher_round.png"))

if __name__ == "__main__":
    purge_and_create_premium_icons()
    print("All old icons successfully purged and replaced with premium AI brain!")
