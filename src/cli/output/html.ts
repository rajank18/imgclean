import type { ScanResult } from '../../types/index.js';
import { formatBytes } from '../../utils/bytes.js';

export function generateHtmlReport(result: ScanResult): string {
  const formatEntries = Object.entries(result.formatBreakdown);
  const totalIssues = result.issues.length;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>imgclean Report · Image Health & Optimization</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --accent-grad: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
      --green: #22c55e;
      --yellow: #eab308;
      --red: #ef4444;
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: var(--font);
      line-height: 1.5;
      padding: 2rem 1rem;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    header {
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .brand h1 {
      font-size: 2rem;
      font-weight: 800;
      background: var(--accent-grad);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.025em;
    }
    .brand p {
      color: var(--text-muted);
      font-size: 0.95rem;
      margin-top: 0.25rem;
    }
    .meta-badge {
      background: var(--card-bg);
      border: 1px solid var(--border);
      padding: 0.5rem 1rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      color: var(--text-muted);
    }
    .grid-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
    }
    .stat-label {
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--text-muted);
      letter-spacing: 0.05em;
    }
    .stat-value {
      font-size: 1.85rem;
      font-weight: 700;
      margin-top: 0.25rem;
    }
    .stat-value.savings { color: var(--green); }
    .stat-value.issues { color: var(--yellow); }

    .section-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .section-title {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .table-container {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.9rem;
    }
    th {
      background: #0f172a80;
      color: var(--text-muted);
      font-weight: 600;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border);
    }
    td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border);
    }
    tr:hover td {
      background: #33415533;
    }
    .badge {
      display: inline-block;
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-oversized { background: #713f12; color: #fef08a; }
    .badge-dimensions { background: #1e3a8a; color: #bfdbfe; }
    .badge-duplicate { background: #581c87; color: #e9d5ff; }
    .badge-metadata { background: #134e4a; color: #99f6e4; }
    .badge-unused { background: #374151; color: #d1d5db; }

    .format-bar-container {
      display: flex;
      height: 12px;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 1rem;
      background: #334155;
    }
    .format-slice { height: 100%; }
    .format-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 0.75rem;
    }
    .format-item {
      display: flex;
      justify-content: space-between;
      padding: 0.5rem 0.75rem;
      background: #0f172a66;
      border-radius: 8px;
      font-size: 0.85rem;
    }
    footer {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.85rem;
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <h1>imgclean Report</h1>
        <p>Target: <code>${result.rootPath}</code></p>
      </div>
      <div class="meta-badge">
        Scan Time: ${result.scanDurationMs}ms · Generated ${new Date().toISOString().split('T')[0]}
      </div>
    </header>

    <!-- Overview Stats -->
    <div class="grid-stats">
      <div class="stat-card">
        <div class="stat-label">Total Images</div>
        <div class="stat-value">${result.totalImages}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Size</div>
        <div class="stat-value">${formatBytes(result.totalSize)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Potential Savings</div>
        <div class="stat-value savings">${formatBytes(result.potentialSavings)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Issues Detected</div>
        <div class="stat-value issues">${totalIssues}</div>
      </div>
    </div>

    <!-- Format Breakdown -->
    <div class="section-card">
      <div class="section-title">Format Breakdown</div>
      <div class="format-grid">
        ${formatEntries
          .map(
            ([fmt, stat]) => `
          <div class="format-item">
            <span><strong>${fmt}</strong> (${stat.count})</span>
            <span>${formatBytes(stat.size)}</span>
          </div>`
          )
          .join('')}
      </div>
    </div>

    <!-- Issues Section -->
    ${
      result.issues.length > 0
        ? `
    <div class="section-card">
      <div class="section-title">Detected Issues (${result.issues.length})</div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>File</th>
              <th>Details</th>
              <th>Potential Savings</th>
            </tr>
          </thead>
          <tbody>
            ${result.issues
              .map(
                (issue) => `
              <tr>
                <td><span class="badge badge-${issue.type}">${issue.type}</span></td>
                <td><code>${issue.file}</code></td>
                <td>${issue.message}</td>
                <td>${issue.potentialSavings ? formatBytes(issue.potentialSavings) : '-'}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>`
        : ''
    }

    <!-- Duplicates Section -->
    ${
      result.duplicates.length > 0
        ? `
    <div class="section-card">
      <div class="section-title">Exact Duplicate Groups (${result.duplicates.length})</div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Copies</th>
              <th>Individual Size</th>
              <th>Potential Savings</th>
              <th>Files</th>
            </tr>
          </thead>
          <tbody>
            ${result.duplicates
              .map(
                (group) => `
              <tr>
                <td>${group.files.length}</td>
                <td>${formatBytes(group.size)}</td>
                <td><strong style="color: var(--green)">${formatBytes(group.potentialSavings)}</strong></td>
                <td>${group.files.map((f) => `<code>${f}</code>`).join('<br/>')}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>`
        : ''
    }

    <!-- All Images Table -->
    <div class="section-card">
      <div class="section-title">All Scanned Images (${result.images.length})</div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Format</th>
              <th>Dimensions</th>
              <th>Size</th>
              <th>Issues</th>
            </tr>
          </thead>
          <tbody>
            ${result.images
              .map((img) => {
                const dims = img.width && img.height ? `${img.width} × ${img.height}` : '-';
                const issues = img.issues && img.issues.length > 0
                  ? img.issues.map((i) => `<span class="badge badge-${i.type}">${i.type}</span>`).join(' ')
                  : '<span style="color: var(--green)">✓ Clean</span>';
                return `
              <tr>
                <td><code>${img.path}</code></td>
                <td>${img.format.toUpperCase()}</td>
                <td>${dims}</td>
                <td>${formatBytes(img.size)}</td>
                <td>${issues}</td>
              </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    </div>

    <footer>
      Generated with <strong>imgclean</strong> · Image Health and Cleanup Tool
    </footer>
  </div>
</body>
</html>`;

  return html;
}
