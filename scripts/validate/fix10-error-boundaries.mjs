// ============================================================
// Fix 10: Error boundaries exist
// ============================================================
// Verifies the 3 Next.js error boundary files exist, are non-
// empty, and are valid React components:
//   - src/app/error.tsx        (root error boundary)
//   - src/app/not-found.tsx    (404 page)
//   - src/app/global-error.tsx (catches errors in root layout)
//
// Strategy:
//   1. Stat each file (must exist, >0 bytes).
//   2. Confirm each has 'use client' directive (error boundaries
//      must be client components in Next.js App Router).
//   3. Confirm each exports a React component (default export).
//   4. Confirm each renders meaningful content (not a stub).
// ============================================================

import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert';

const ROOT = process.cwd();

const FILES = [
  { path: 'src/app/error.tsx',        mustHaveClient: true,  nameHint: 'error' },
  { path: 'src/app/not-found.tsx',    mustHaveClient: false, nameHint: '404' },
  { path: 'src/app/global-error.tsx', mustHaveClient: true,  nameHint: 'global-error' },
];

for (const { path: relPath, mustHaveClient, nameHint } of FILES) {
  const abs = resolve(ROOT, relPath);

  // ─── Existence & non-empty ──────────────────────────────
  assert.ok(existsSync(abs), `File must exist: ${relPath}`);
  const stat = statSync(abs);
  assert.ok(stat.size > 100, `${relPath} must be non-trivial (>100 bytes), got ${stat.size}`);
  console.log(`✓ ${relPath} exists (${stat.size} bytes)`);

  const src = readFileSync(abs, 'utf8');

  // ─── 'use client' directive ─────────────────────────────
  if (mustHaveClient) {
    assert.ok(
      /^['"]use client['"];?/m.test(src),
      `${relPath} must start with 'use client' directive (error boundaries are client components)`
    );
    console.log(`✓ ${relPath} has 'use client' directive`);
  }

  // ─── Default export ─────────────────────────────────────
  assert.ok(
    /export\s+default\s+function\s+\w+\s*\(/.test(src),
    `${relPath} must export a default function component`
  );
  console.log(`✓ ${relPath} has a default-exported React component`);

  // ─── Meaningful content ─────────────────────────────────
  // Each error boundary should render a <div> or <html> with text
  assert.ok(
    /return\s*\(\s*</.test(src),
    `${relPath} must return JSX`
  );
  assert.ok(
    /<(div|html|button)/.test(src),
    `${relPath} must render real DOM elements (not a stub)`
  );

  // ─── Boundary-specific hints ────────────────────────────
  if (nameHint === '404') {
    assert.ok(/404/.test(src), `${relPath} should display "404"`);
    console.log(`✓ ${relPath} displays "404"`);
  }
  if (nameHint === 'error' || nameHint === 'global-error') {
    // Should accept error + reset props
    assert.ok(
      /error\s*[:,]/.test(src) || /\{\s*error\s*,\s*reset\s*\}/.test(src),
      `${relPath} should accept {error, reset} props`
    );
    console.log(`✓ ${relPath} accepts error/reset props`);
  }

  // ─── global-error must render <html><body> (root layout bypass) ──
  if (nameHint === 'global-error') {
    assert.ok(/<html/.test(src), `${relPath} must render its own <html> tag`);
    assert.ok(/<body/.test(src), `${relPath} must render its own <body> tag`);
    console.log(`✓ ${relPath} renders <html> and <body> (required for global-error)`);
  }

  console.log('---');
}

// ─── Verbatim excerpt from each file (first 5 non-empty lines) ──
for (const { path: relPath } of FILES) {
  const src = readFileSync(resolve(ROOT, relPath), 'utf8');
  const lines = src.split('\n').filter(l => l.trim().length > 0).slice(0, 5);
  console.log(`\n--- ${relPath} (first 5 non-empty lines) ---`);
  console.log(lines.join('\n'));
}

console.log('\n✅ PASS: All 3 error boundary files exist with proper React components.');
process.exit(0);
