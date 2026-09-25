# imgclean

Clean up image bloat in your web projects.

**imgclean** scans your project, detects image bloat and duplicates, finds unreferenced images, estimates bandwidth savings, and safely optimizes images.

---

## Quick Start

Run instantly with npx (no install needed):

```bash
npx imgclean scan
```

Or install as a dev dependency:

```bash
npm install -D imgclean
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
import { scanProject, optimizeImage, checkBudget } from 'imgclean';

// Scan directory
const scan = await scanProject('./public');
console.log(`Images: ${scan.totalImages}, Savings: ${scan.potentialSavings}B`);

// Optimize image
const result = await optimizeImage('./public/hero.png', {
  format: 'webp',
  targetSize: '300kb',
});

// Check budget
const budget = checkBudget(scan.images, { total: '10mb', single: '500kb' });
```

---

## Supported Formats

`jpg` · `jpeg` · `png` · `webp` · `avif` · `gif` · `tiff` · `svg`

---

## License

[MIT](LICENSE)
