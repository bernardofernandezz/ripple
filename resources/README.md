# Ripple Branding Assets

This directory contains the branding assets for the Ripple VS Code extension.

## Files

- **icon.svg** - Activity bar icon (128x128) with ripple wave design
- **logo-dark.svg** - Logo for dark themes (400x120)
- **logo-light.svg** - Logo for light themes (400x120)
- **banner.svg** - Marketplace banner (1200x300)

## Converting SVG to PNG

If you need PNG versions of these assets, you can use one of these methods:

### Using Inkscape (Command Line)
```bash
# Install Inkscape first, then:
inkscape resources/icon.svg --export-filename=resources/icon.png --export-width=128 --export-height=128
inkscape resources/logo-dark.svg --export-filename=resources/logo-dark.png --export-width=400 --export-height=120
inkscape resources/logo-light.svg --export-filename=resources/logo-light.png --export-width=400 --export-height=120
inkscape resources/banner.svg --export-filename=resources/banner.png --export-width=1200 --export-height=300
```

### Using ImageMagick
```bash
# Install ImageMagick first, then:
magick convert resources/icon.svg -resize 128x128 resources/icon.png
magick convert resources/logo-dark.svg -resize 400x120 resources/logo-dark.png
magick convert resources/logo-light.svg -resize 400x120 resources/logo-light.png
magick convert resources/banner.svg -resize 1200x300 resources/banner.png
```

### Using Online Tools
- [CloudConvert](https://cloudconvert.com/svg-to-png)
- [Convertio](https://convertio.co/svg-png/)

## Design Guidelines

### Colors
- Primary Gradient: `#667eea` → `#764ba2`
- White: `#ffffff` (for contrast)
- Dark Text: `#333333`
- Light Text: `#cccccc`

### Icon Specifications
- Size: 128x128 pixels
- Format: SVG (scalable)
- Style: Minimalist ripple waves emanating from center
- Background: Gradient circle

### Logo Specifications
- Size: 400x120 pixels
- Format: SVG (scalable)
- Includes: Icon + "Ripple" text + tagline
- Two versions: Dark theme and Light theme

### Banner Specifications
- Size: 1200x300 pixels (VS Code Marketplace standard)
- Format: SVG (scalable)
- Includes: Large icon, title, tagline, and feature highlights

## Brand Identity

**Name:** Ripple  
**Tagline:** "See the impact of every code change before you make it"

The ripple wave design represents:
- **Impact Propagation**: One change creates waves throughout the codebase
- **Visual Clarity**: Easy to understand dependency relationships
- **Fluid Dynamics**: Code changes flow through dependencies like water ripples

