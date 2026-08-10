import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Installing Pillow...")
    os.system("pip install pillow")
    from PIL import Image, ImageDraw, ImageFont

def create_app_icon(output_path="assets/icon.ico"):
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    
    # 256x256 High-Resolution Canvas
    size = (256, 256)
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Outer Frame (Dark Luxury Navy Blue with Cyan/Blue glowing border)
    draw.rounded_rectangle([6, 6, 250, 250], radius=52, fill=(15, 23, 42, 255), outline=(37, 99, 235, 255), width=6)
    draw.rounded_rectangle([18, 18, 238, 238], radius=42, fill=(30, 41, 59, 255), outline=(59, 130, 246, 255), width=3)

    # 2. Isometric Storage / POS Box (NASSER Company Brand Logo)
    # Box Top Lid (Lighter Blue)
    draw.polygon([(128, 48), (202, 86), (128, 124), (54, 86)], fill=(37, 99, 235, 255), outline=(147, 197, 253, 255))
    # Box Left Face (Mid Blue)
    draw.polygon([(54, 86), (128, 124), (128, 202), (54, 164)], fill=(29, 78, 216, 255), outline=(147, 197, 253, 255))
    # Box Right Face (Dark Blue)
    draw.polygon([(128, 124), (202, 86), (202, 164), (128, 202)], fill=(30, 58, 138, 255), outline=(147, 197, 253, 255))

    # 3. Gold Accent Shield Badge for "NASSER"
    draw.ellipse([100, 96, 156, 152], fill=(245, 158, 11, 255), outline=(254, 240, 138, 255), width=3)

    # 4. Draw Letter "N"
    # Left vertical leg
    draw.rectangle([114, 108, 120, 140], fill=(255, 255, 255, 255))
    # Right vertical leg
    draw.rectangle([136, 108, 142, 140], fill=(255, 255, 255, 255))
    # Diagonal bar
    draw.polygon([(114, 108), (120, 108), (142, 140), (136, 140)], fill=(255, 255, 255, 255))

    # Save as ICO file containing multiple Windows standard sizes
    icon_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    img.save(output_path, format="ICO", sizes=icon_sizes)
    
    # Also save PNG copy
    png_path = output_path.replace(".ico", ".png")
    img.save(png_path, format="PNG")
    print(f"✅ Generated Windows Icon at: {output_path} and {png_path}")

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "assets/icon.ico"
    create_app_icon(out)
