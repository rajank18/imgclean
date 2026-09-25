# imgclean

Clean up image bloat in your web projects.

**imgclean** is a project-level image health and cleanup tool designed for web applications. Rather than just converting formats, `imgclean` scans your codebase, detects image bloat, identifies duplicate and unused assets, calculates potential bandwidth savings, generates interactive reports, and safely optimizes images.

---

## Key Features

- **Project-Wide Scanning**: Recursively discovers images and analyzes dimensions, aspect ratios, channels, alpha transparency, and metadata.
- **Issue & Bloat Detection**: Automatically flags oversized images (>500 KB), excessive dimensions (>2560px), non-essential EXIF/IPTC/XMP metadata, and duplicates.
- **Exact Duplicate Detection**: Groups identical images using SHA-256 cryptographic hashes and calculates duplicate storage waste.
- **Unused Image Detection**: Statically scans source code (`.html`, `.jsx`, `.tsx`, `.vue`, `.svelte`, `.css`, `.ts`, `.js`, `.md`) to detect unreferenced images.
- **Interactive Reports**: Export detailed reports in standalone **HTML** (with responsive dashboard UI), **JSON**, or **Markdown**.
- **Target Size Optimization**: Optimize images to an exact target file size (e.g. `--target-size 300kb`) via intelligent binary search over quality.
- **Safe Cleanup**: Never overwrites original files by default. Saves optimized images into a clean `.imgclean/` directory or simulates with `--dry-run`.
- **CI Budget Enforcement**: Prevent image bloat from entering main branches with `imgclean ci` (exits with code `0` on pass, `1` on budget breach).

---

## Installation

```bash
# Install as a dev dependency
npm install -D imgclean

# Or run instantly with npx
npx imgclean scan
```

---

## Quick Start

### 1. Scan your project
```bash
imgclean scan
```

Output:
```text
imgclean
Scanning ./public...

✓ 42 images scanned

IMAGE SIZE
────────────────────────────
Total             18.4 MB
Potential savings  9.7 MB

ISSUES
────────────────────────────
⚠ Oversized          8
⚠ Large dimensions   2
⚠ Duplicates         3
⚠ Metadata           2
⚠ Possibly unused    1

LARGEST FILES
────────────────────────────
hero.png             2.8 MB
banner.jpg           1.4 MB
product.png          982 KB

FORMAT BREAKDOWN
────────────────────────────
PNG                   8.2 MB
JPEG                  5.1 MB
WebP                  4.3 MB
AVIF                  0.8 MB

Run `imgclean fix` to optimize images.
```

---

## CLI Commands

### `imgclean scan [path]`
Performs image analysis across the directory.

```bash
# Scan current directory
imgclean scan

# Scan specific folder
imgclean scan ./public

# Verbose output with detailed issue explanations
imgclean scan --verbose

# Output machine-readable JSON to stdout
imgclean scan --json

# Generate a standalone HTML report
imgclean scan --report=html

# Generate Markdown or JSON report files
imgclean scan --report=md
imgclean scan --report=json --output ./reports/images.json
```

| Option | Description |
| :--- | :--- |
| `-v, --verbose` | Show detailed finding descriptions for each file |
| `--json` | Print raw JSON scan result to `stdout` |
| `--report <format>` | Generate export report (`html`, `json`, `md`) |
| `-o, --output <path>` | Custom output destination for the report file |
| `-c, --config <path>` | Custom path to configuration file |

---

### `imgclean fix [path]`
Safely optimizes, compresses, resizes, and converts images.

```bash
# Dry run: preview optimizations without touching the filesystem
imgclean fix ./public --dry-run

# Compress images with custom quality
imgclean fix ./public --compress --quality 80

# Convert images to modern formats (webp, avif, png, jpeg)
imgclean fix ./public --format webp

# Downscale oversized dimensions preserving aspect ratio
imgclean fix ./public --resize --max-width 1920

# Optimize image to meet a target file size
imgclean fix hero.jpg --target-size 300kb

# Strip non-essential EXIF / IPTC metadata
imgclean fix ./public --strip-metadata
```

| Option | Description |
| :--- | :--- |
| `--dry-run` | Simulate optimization without creating or modifying files |
| `--compress` | Apply format-specific lossy compression |
| `--quality <number>` | Compression quality (1–100, default: 80) |
| `--format <format>` | Target format (`webp`, `avif`, `png`, `jpeg`) |
| `--resize` | Downscale images larger than max dimensions |
| `--max-width <pixels>` | Maximum allowable width |
| `--max-height <pixels>` | Maximum allowable height |
| `--target-size <size>` | Automatically tune quality to fit under target size (e.g. `300kb`, `1.5mb`) |
| `--strip-metadata` | Remove EXIF, IPTC, and XMP headers |
| `--output <dir>` | Destination folder for optimized images |
| `-c, --config <path>` | Custom path to configuration file |

> **Safe by Default**: `imgclean fix` never overwrites original files unless explicitly instructed. Optimized files are placed into `.imgclean/` preserving folder hierarchy.

---

### `imgclean ci`
Enforces image budgets in GitHub Actions, GitLab CI, and automated workflows.

```bash
imgclean ci
```

Example CI output on failure:
```text
IMAGE BUDGET
──────────────────────────────
Current: 12.4 MB
Budget:  10 MB

✗ Total budget exceeded by 2.4 MB

Process exited with code 1.
```

---

### `imgclean init`
Creates a default `imgclean.config.json` configuration file in your project root:

```bash
imgclean init
```

---

## Configuration (`imgclean.config.json`)

```json
{
  "include": [
    "public/**/*",
    "src/assets/**/*"
  ],
  "exclude": [
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build"
  ],
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

You can use `imgclean` programmatically in Node.js / TypeScript:

```typescript
import {
  scanProject,
  analyzeImage,
  optimizeImage,
  optimizeProject,
  checkBudget
} from 'imgclean';

// 1. Scan and analyze project
const result = await scanProject('./public');
console.log(`Total images: ${result.totalImages}`);
console.log(`Potential savings: ${result.potentialSavings} bytes`);
console.log(`Duplicates detected: ${result.duplicates.length}`);

// 2. Optimize a single image to target size
const optResult = await optimizeImage('./public/hero.png', {
  format: 'webp',
  targetSize: '300kb',
});
console.log(`Optimized size: ${optResult.optimizedSize} bytes`);

// 3. Enforce budget programmatically
const budgetStatus = checkBudget(result.images, {
  total: '10mb',
  single: '500kb',
});
console.log(`Budget passed: ${budgetStatus?.passed}`);
```

---

## Supported Image Formats

- **JPEG / JPG**
- **PNG**
- **WebP**
- **AVIF**
- **GIF**
- **TIFF**
- **SVG**

---

## License

[MIT](LICENSE)
