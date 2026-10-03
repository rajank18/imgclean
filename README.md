<div align="center">
  <h1>imgclean</h1>
  <p><strong>Project-level image health and cleanup tool for web projects</strong></p>
  <p><em>Scan, detect bloat, estimate savings, and safely optimize images</em></p>

  <p>
    <a href="https://www.npmjs.com/package/imgclean"><img src="https://img.shields.io/npm/v/imgclean.svg?style=flat-square&color=fe5f00" alt="npm" /></a>
    <a href="https://www.npmjs.com/package/imgclean"><img src="https://img.shields.io/npm/dm/imgclean.svg?style=flat-square&color=00c7b7" alt="downloads" /></a>
    <a href="https://github.com/rajank18/imgclean"><img src="https://img.shields.io/badge/CI-passing-44cc11?style=flat-square" alt="CI" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-007ec6?style=flat-square" alt="license" /></a>
  </p>

  <p>
    <a href="#installation">Installation</a> ·
    <a href="#commands">Commands</a> ·
    <a href="#configuration-imgcleanconfigjson">Configuration</a> ·
    <a href="#programmatic-api">API Reference</a>
  </p>
</div>

---

## Installation

```bash
# Run instantly without installing
npx imgclean scan

# Or install locally in your project (run with npx imgclean)
npm install -D imgclean

# Or install globally (run imgclean directly from anywhere)
npm install -g imgclean
```

---

## Commands

### `imgclean scan [path]`

Scans your project and prints an image health summary:

```bash
# Scan current project
imgclean scan

# Scan specific folder
imgclean scan ./public

# Verbose breakdown of every issue
imgclean scan --verbose

# Export standalone HTML dashboard
imgclean scan --report=html

# Export Markdown or JSON report
imgclean scan --report=md
imgclean scan --report=json
```

---

### `imgclean convert <path> to <format>`

Directly converts any image or entire folder to another format without altering original quality. Saves in the same directory by default.

```bash
# Convert a single image
imgclean convert ./hero.png to webp

# Convert and delete/replace the original file
imgclean convert ./hero.png to webp --replace

# Convert all images in a folder
imgclean convert ./public/images to avif

# Convert image to Windows/browser icon
imgclean convert ./favicon.png to ico

# Convert SVG vector to high-res PNG
imgclean convert ./logo.svg to png
```

| Option | Description |
| :--- | :--- |
| `--replace` | Delete original image file after successful conversion |
| `--quality <number>` | Conversion quality 1–100 (default: 90) |
| `--size <number>` | Icon dimension when converting to `.ico` (default: 256) |
| `-o, --output <dir>` | Optional destination folder |

---

### `imgclean fix [path]`

Safely optimizes images. Originals are never overwritten by default (saved to `.imgclean/`).

```bash
# Preview optimizations without writing files
imgclean fix ./public --dry-run

# Compress with custom quality (1-100)
imgclean fix ./public --compress --quality 80

# Convert to modern format (webp, avif, png, jpeg)
imgclean fix ./public --format webp

# Downscale oversized dimensions preserving aspect ratio
imgclean fix ./public --resize --max-width 1920

# Optimize to fit an exact target file size
imgclean fix hero.jpg --target-size 300kb

# Strip EXIF and metadata headers
imgclean fix ./public --strip-metadata
```

---

### `imgclean ci`

Enforce image budgets in CI/CD pipelines. Exits with code `0` on pass and `1` on budget breach.

```bash
imgclean ci
```

---

### `imgclean init`

Creates a default `imgclean.config.json` in your project:

```bash
imgclean init
```

---

## Configuration (`imgclean.config.json`)

```json
{
  "include": ["public/**/*", "src/assets/**/*"],
  "exclude": ["node_modules", ".git", ".next", "dist"],
  "maxSize": "500kb",
  "maxDimension": 2560,
  "budgets": {
    "total": "10mb",
    "single": "500kb"
  },
  "rules": {
    "oversized": true,
    "dimensions": true,
    "duplicates": true,
    "unused": true,
    "metadata": true
  }
}
```

---

## Programmatic API

```typescript
import { scanProject, convertImage, optimizeImage, checkBudget } from 'imgclean';

// 1. Direct format conversion
await convertImage('./hero.png', 'webp', { quality: 90 });

// 2. Scan directory
const scan = await scanProject('./public');
console.log(`Images: ${scan.totalImages}, Savings: ${scan.potentialSavings}B`);

// 3. Optimize image to target size
const result = await optimizeImage('./public/hero.png', {
  format: 'webp',
  targetSize: '300kb',
});

// 4. Check budget
const budget = checkBudget(scan.images, { total: '10mb', single: '500kb' });
```

---

## Supported Formats for scanning and cleanup

`jpg` · `jpeg` · `png` · `webp` · `avif` · `gif` · `tiff` · `svg` · `ico`

---

## License

[MIT](LICENSE)
