import os
from PIL import Image, ImageDraw

def create_premium_icons():
    sizes = {
        "mdpi": 48,
        "hdpi": 72,
        "xhdpi": 96,
        "xxhdpi": 144,
        "xxxhdpi": 192
    }
    
    # Path to the generated image
    generated_img_path = r"C:\Users\dell5540\.gemini\antigravity\brain\bbda2b3f-d140-4141-9546-a76b2c715741\premium_serenity_icon_1784117432097.png"
    
    if not os.path.exists(generated_img_path):
        print(f"Error: Could not find image at {generated_img_path}")
        return

    # Open the generated image
    logo = Image.open(generated_img_path).convert("RGBA")
    
    # We want to embed this logo into a 1080x1080 canvas so that it is safely inside the 720x720 safe zone (66%).
    # To maximize the visible area while ensuring it doesn't get clipped by circular masks, 
    # we will scale the logo to 720x720.
    base_size = 1080
    safe_size = 720
    
    # Create the base canvas with the background color #081B29
    bg_color = (8, 27, 41, 255)  # #081B29
    fg = Image.new('RGBA', (base_size, base_size), bg_color)
    
    # Resize the logo to fit the safe zone
    logo_resized = logo.resize((safe_size, safe_size), Image.Resampling.LANCZOS)
    
    # Calculate centering
    offset = (base_size - safe_size) // 2
    
    # Paste the logo into the center of the canvas
    # Since logo has no transparency, it just replaces the pixels in the center block. 
    # The edges (180px on each side) will be the solid #081B29 color, blending seamlessly into the logo's background.
    fg.paste(logo_resized, (offset, offset))
    
    base_dir = r"d:\dha suffa\FYP PROJECT\SerenityAI\Frontend\android\app\src\main\res"
    
    for dpi, size in sizes.items():
        out_dir = os.path.join(base_dir, f"mipmap-{dpi}")
        os.makedirs(out_dir, exist_ok=True)
        
        # Adaptive foreground (needs to be 108/48 * size)
        adaptive_size = int(size * (108 / 48))
        fg_adaptive = fg.resize((adaptive_size, adaptive_size), Image.Resampling.LANCZOS)
        fg_adaptive.save(os.path.join(out_dir, "ic_launcher_foreground.png"))
        
        # Legacy square icon (just use a crop of the safe zone to ensure the logo fills it better)
        # Actually, for legacy, we just want the logo to fill the square.
        # Since the logo is 1024x1024 originally, we can just use the original logo resized!
        legacy_size = size
        legacy = logo.resize((legacy_size, legacy_size), Image.Resampling.LANCZOS)
        legacy.save(os.path.join(out_dir, "ic_launcher.png"))
        
        # Legacy round icon (mask the original logo with a circle)
        legacy_round = Image.new('RGBA', (legacy_size, legacy_size), (0, 0, 0, 0))
        mask = Image.new('L', (legacy_size, legacy_size), 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, legacy_size, legacy_size), fill=255)
        
        legacy_round.paste(legacy, (0, 0), mask=mask)
        legacy_round.save(os.path.join(out_dir, "ic_launcher_round.png"))

if __name__ == "__main__":
    create_premium_icons()
    print("Premium icons generated successfully!")
