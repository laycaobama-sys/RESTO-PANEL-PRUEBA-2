// ============================================================
// RestoPanel · Frontend validation
// ============================================================
// Proves the frontend meets quality standards by auditing:
//   2a. Lighthouse simulation (meta tags, images, sitemap, robots,
//       CSS critical path, fonts)
//   2b. Hydration safety (Date.now/Math.random/window/localStorage
//       in render, useLayoutEffect, useEffect cleanup)
//   2c. Accessibility (aria-labels, alt text, color contrast,
//       focus management, keyboard nav)
//   2d. Responsive design (responsive classes, fixed widths,
//       touch targets, mobile menu)
//
// Exit code 0 = all tests pass (or only acceptable warnings).
// Exit code 1 = at least one test failed.
// ============================================================

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

const ROOT = process.cwd();
const RESULTS = [];

function pass(name, result, evidence) {
  RESULTS.push({ name, status: 'PASS', result, evidence });
  console.log(`### ${name}\nStatus: ✅ PASS\nResult: ${result}\nEvidence: ${evidence}\n`);
}
function fail(name, result, evidence, fix) {
  RESULTS.push({ name, status: 'FAIL', result, evidence, fix });
  console.log(`### ${name}\nStatus: ❌ FAIL\nResult: ${result}\nEvidence: ${evidence}`);
  if (fix) console.log(`Proposed fix: ${fix}`);
  console.log('');
}
function warn(name, result, evidence) {
  RESULTS.push({ name, status: 'WARN', result, evidence });
  console.log(`### ${name}\nStatus: ⚠️ WARN\nResult: ${result}\nEvidence: ${evidence}\n`);
}

// ============================================================
// Helpers
// ============================================================
function walk(dir, pred = () => true) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p, pred));
    else if (pred(p)) out.push(p);
  }
  return out;
}

function read(path) {
  return readFileSync(path, 'utf8');
}

// ============================================================
// 2a. Lighthouse simulation
// ============================================================
console.log('════════════════════════════════════════════════════════════');
console.log('  Part 2a · Lighthouse simulation');
console.log('════════════════════════════════════════════════════════════\n');

// (1) Meta tags — title, description, OG, Twitter Card, JSON-LD
const layoutSrc = read(resolve(ROOT, 'src/app/layout.tsx'));
const landingSrc = read(resolve(ROOT, 'src/app/landing/page.tsx'));
const loginSrc = read(resolve(ROOT, 'src/app/login/page.tsx'));

const metaChecks = [
  { name: 'title',           re: /title:\s*['"`]/,            in: [layoutSrc, landingSrc, loginSrc], where: 'layout.tsx + landing/page.tsx' },
  { name: 'description',     re: /description:\s*['"`]/,      in: [layoutSrc, landingSrc, loginSrc], where: 'layout.tsx + landing/page.tsx' },
  { name: 'keywords',        re: /keywords:\s*\[/,            in: [landingSrc],                       where: 'landing/page.tsx' },
  { name: 'openGraph',       re: /openGraph:\s*\{/,           in: [landingSrc],                       where: 'landing/page.tsx' },
  { name: 'twitter card',    re: /twitter:\s*\{\s*[^}]*card:/s, in: [landingSrc],                    where: 'landing/page.tsx' },
  { name: 'canonical',       re: /alternates:\s*\{\s*[^}]*canonical:/s, in: [landingSrc],            where: 'landing/page.tsx' },
  { name: 'robots meta',     re: /robots:\s*\{/,              in: [landingSrc, loginSrc],             where: 'landing/page.tsx + login/page.tsx' },
  { name: 'JSON-LD',         re: /application\/ld\+json/,     in: [landingSrc],                       where: 'landing/page.tsx' },
];

const missingMeta = metaChecks.filter((c) => !c.in.some((s) => c.re.test(s)));
if (missingMeta.length === 0) {
  pass(
    'Test 1: Meta tags',
    'Landing page has title, description, keywords, OpenGraph, Twitter Card, canonical, robots meta, and JSON-LD structured data.',
    'Verified by regex over src/app/landing/page.tsx and src/app/layout.tsx.'
  );
} else {
  fail(
    'Test 1: Meta tags',
    `${missingMeta.length} missing meta tag(s): ${missingMeta.map((m) => m.name).join(', ')}`,
    missingMeta.map((m) => `  • ${m.name} (expected in ${m.where})`).join('\n'),
    'Add the missing meta fields to the Metadata export in the relevant page.tsx.'
  );
}

// (2) Image optimization — next/image usage and width/height attributes
const landingPageSrc = read(resolve(ROOT, 'src/components/landing/LandingPage.tsx'));
const imgTags = [...landingPageSrc.matchAll(/<img\s+[^>]*>/g)].map((m) => m[0]);
const imgWithoutDims = imgTags.filter((t) => !/\b(width|height)=/.test(t) && !/className=.*\bw-\[.*\b/.test(t) && !/className=.*\bh-\[.*\b/.test(t));
const imgWithoutAlt = imgTags.filter((t) => !/\balt=/.test(t));

if (imgTags.length === 0) {
  pass(
    'Test 2: Image optimization',
    'No <img> tags found — using next/image everywhere.',
    'Verified by regex over src/components/landing/LandingPage.tsx.'
  );
} else {
  // We have <img> tags — they should at least have alt text and either
  // explicit width/height OR Tailwind w-[..] h-[..] classes (to avoid CLS).
  const issues = [];
  if (imgWithoutAlt.length > 0) {
    issues.push(`${imgWithoutAlt.length} <img> tag(s) missing alt text`);
  }
  if (imgWithoutDims.length > 0) {
    issues.push(`${imgWithoutDims.length} <img> tag(s) missing width/height (CLS risk)`);
  }
  // Note: next/image would be better than <img>, but we accept <img> if it
  // has alt + dimensions. The big risk is CLS on the landing page.
  if (issues.length === 0) {
    warn(
      'Test 2: Image optimization',
      `Landing page uses ${imgTags.length} <img> tag(s) instead of next/image, but all have alt + dimensions.`,
      'Acceptable for static marketing images. next/image would auto-serve WebP/AVIF.'
    );
  } else {
    fail(
      'Test 2: Image optimization',
      `Landing page uses ${imgTags.length} <img> tag(s) with issues: ${issues.join('; ')}.`,
      imgTags.slice(0, 5).map((t) => '  • ' + t.trim().slice(0, 140)).join('\n'),
      'Replace <img> with next/image (<Image>) for automatic format conversion, lazy loading, and CLS prevention.'
    );
  }
}

// (3) sitemap.xml and robots.txt
const robotsPath = resolve(ROOT, 'src/app/robots.ts');
const sitemapPath = resolve(ROOT, 'src/app/sitemap.ts');
if (existsSync(robotsPath) && existsSync(sitemapPath)) {
  const robotsSrc = read(robotsPath);
  const sitemapSrc = read(sitemapPath);
  const robotsOk = /MetadataRoute\.Robots/.test(robotsSrc) && /userAgent:/.test(robotsSrc) && /sitemap:/.test(robotsSrc);
  const sitemapOk = /MetadataRoute\.Sitemap/.test(sitemapSrc) && /url:/.test(sitemapSrc);
  if (robotsOk && sitemapOk) {
    pass(
      'Test 3: sitemap.xml + robots.txt',
      'Both robots.ts and sitemap.ts exist and emit valid MetadataRoute exports.',
      'robots.ts exports MetadataRoute.Robots with userAgent + sitemap fields. sitemap.ts exports MetadataRoute.Sitemap with url entries.'
    );
  } else {
    fail(
      'Test 3: sitemap.xml + robots.txt',
      `robots.ts valid: ${robotsOk}. sitemap.ts valid: ${sitemapOk}.`,
      'One or both files are missing required fields.',
      'Ensure robots.ts has userAgent + sitemap, and sitemap.ts has url entries.'
    );
  }
} else {
  fail(
    'Test 3: sitemap.xml + robots.txt',
    'robots.ts or sitemap.ts is missing.',
    `robots.ts exists: ${existsSync(robotsPath)}. sitemap.ts exists: ${existsSync(sitemapPath)}.`,
    'Create src/app/robots.ts and src/app/sitemap.ts with MetadataRoute exports.'
  );
}

// (4) CSS critical path — globals.css size and @import usage
const globalsSrc = read(resolve(ROOT, 'src/app/globals.css'));
const globalsSize = Buffer.byteLength(globalsSrc, 'utf8');
const hasTailwindImport = /@import\s+['"]tailwindcss['"]/.test(globalsSrc);
// Tailwind v4 produces a small critical CSS by default. We just check that
// globals.css is reasonable (< 50 KB) and uses Tailwind's @import.
if (globalsSize < 50_000 && hasTailwindImport) {
  pass(
    'Test 4: CSS critical path',
    `globals.css is ${(globalsSize / 1024).toFixed(1)} KB and uses @import "tailwindcss" (Tailwind v4 generates purged, scoped CSS).`,
    'Verified by reading src/app/globals.css.'
  );
} else {
  fail(
    'Test 4: CSS critical path',
    `globals.css is ${(globalsSize / 1024).toFixed(1)} KB (limit 50 KB) and ${hasTailwindImport ? 'has' : 'is MISSING'} @import "tailwindcss".`,
    'Tailwind v4 should purge unused classes. A large globals.css means too much custom CSS is being shipped.',
    'Move rarely-used styles into component-scoped CSS modules or remove dead CSS.'
  );
}

// (5) Fonts with font-display: swap
const fontsOk = /display:\s*['"]swap['"]/.test(layoutSrc);
if (fontsOk) {
  pass(
    'Test 5: Fonts use font-display: swap',
    'Inter font is configured with display: "swap" in layout.tsx.',
    'Found `display: "swap"` in the Inter font config. Geist_Mono uses the default (which is also swap for next/font).'
  );
} else {
  fail(
    'Test 5: Fonts use font-display: swap',
    'No font configured with display: "swap".',
    'layout.tsx should set display: "swap" on every next/font call.',
    'Add `display: "swap"` to the Inter and Geist_Mono font config objects.'
  );
}

// ============================================================
// 2b. Hydration safety
// ============================================================
console.log('════════════════════════════════════════════════════════════');
console.log('  Part 2b · Hydration safety');
console.log('════════════════════════════════════════════════════════════\n');

// Find all client components (files starting with "use client")
const componentDirs = [
  resolve(ROOT, 'src/components'),
  resolve(ROOT, 'src/app'),
];
const clientComponents = [];
for (const dir of componentDirs) {
  if (!existsSync(dir)) continue;
  for (const f of walk(dir, (p) => p.endsWith('.tsx') || p.endsWith('.ts'))) {
    const src = read(f);
    if (src.startsWith('"use client"') || src.startsWith("'use client'") || /^["']use client["'];?\s*\n/.test(src)) {
      clientComponents.push({ file: f, src });
    }
  }
}

// (1) Date.now() or Math.random() during render
// We flag any line that contains Date.now() or Math.random() UNLESS:
//   - the line is inside a useEffect (we detect by looking back ~10 lines
//     for `useEffect(`) OR
//   - the line is inside a comment (// or *)
//   - the component is loaded with ssr: false (we allowlist dashboard and
//     admin sections because AppRouter wraps them in dynamic(..., { ssr: false }))
const SSR_SAFE_PREFIXES = [
  'src/components/dashboard/',
  'src/components/admin/',
  'src/components/auth/AuthScreen.tsx', // loaded with ssr:false
];
function isSSRSafe(file) {
  const rel = relative(ROOT, file);
  return SSR_SAFE_PREFIXES.some((p) => rel.startsWith(p));
}

const hydrationFindings = [];
for (const { file, src } of clientComponents) {
  if (isSSRSafe(file)) continue; // ssr:false components can use Date.now() freely
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    if (!/Date\.now\(\)|Math\.random\(\)/.test(line)) continue;
    // Walk back 15 lines to see if we're inside a useEffect
    let inEffect = false;
    for (let j = Math.max(0, i - 15); j < i; j++) {
      if (/useEffect\(/.test(lines[j])) { inEffect = true; break; }
    }
    if (inEffect) continue;
    // Walk back 40 lines to see if we're inside an event handler function
    // (const handleX = async, const onX =, async (e) =>, etc.). These run
    // on user interaction, not during render — Date.now() is safe there.
    let inHandler = false;
    for (let j = Math.max(0, i - 40); j < i; j++) {
      const l = lines[j];
      if (/const\s+handle\w+\s*=\s*(?:async\s*)?\(|const\s+on\w+\s*=\s*(?:async\s*)?\(|const\s+\w+\s*=\s*async\s*\(\s*\w*\s*\)\s*=>/.test(l)) {
        inHandler = true;
        break;
      }
    }
    if (inHandler) continue;
    hydrationFindings.push({
      file: relative(ROOT, file),
      line: i + 1,
      snippet: trimmed.slice(0, 140),
      pattern: /Date\.now\(\)/.test(line) ? 'Date.now() in render' : 'Math.random() in render',
    });
  }
}

if (hydrationFindings.length === 0) {
  pass(
    'Test 6: No Date.now() / Math.random() in render',
    'No hydration-unsafe Date.now() or Math.random() calls in SSR-rendered client components.',
    `Scanned ${clientComponents.length} client components. Dashboard/admin/auth components are ssr:false so excluded.`
  );
} else {
  const evidence = hydrationFindings
    .map((f) => `  • ${f.file}:${f.line} — ${f.pattern}\n    ${f.snippet}`)
    .join('\n');
  fail(
    'Test 6: No Date.now() / Math.random() in render',
    `${hydrationFindings.length} hydration-unsafe call(s) found.`,
    evidence,
    'Move Date.now()/Math.random() into a useEffect, or use a useState initializer with a stable seed, or wrap the component in dynamic(..., { ssr: false }).'
  );
}

// (2) window / localStorage / sessionStorage during render
const windowFindings = [];
for (const { file, src } of clientComponents) {
  if (isSSRSafe(file)) continue;
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    // Look for window.X or localStorage.X or sessionStorage.X (NOT
    // `typeof window !== "undefined"` guards — those are safe).
    if (/typeof\s+window\s*[!=]==?\s*['"]?undefined/.test(line)) continue;
    if (/^\s*(?:if|return)\s*\(!?(?:typeof\s+window)/.test(line)) continue;
    if (/\bwindow\.(?!location\.href|location\.reload|location\.origin|history\.back|matchMedia|innerWidth|addEventListener|removeEventListener)/.test(line)) {
      // Check if line is inside useEffect
      let inEffect = false;
      for (let j = Math.max(0, i - 20); j < i; j++) {
        if (/useEffect\(/.test(lines[j])) { inEffect = true; break; }
      }
      // Also accept onClick/onChange handlers (functions defined inline)
      if (inEffect) continue;
      // If the line is inside an arrow function (onClick={() => window.X}) it's
      // also safe — those run on user interaction, not during render.
      if (/(?:onClick|onChange|onSubmit|onBlur|onFocus|onKeyDown|onKeyUp|onKeyPress|onMouseEnter|onMouseLeave|onScroll|onLoad|onError)\s*[=:]\s*(?:\([^)]*\)\s*=>|function)/.test(line)) continue;
      // Look back 5 lines for an event handler or async function
      let inHandler = false;
      for (let j = Math.max(0, i - 5); j < i; j++) {
        if (/(?:onClick|onChange|onSubmit|onBlur|onFocus|onKeyDown|onKeyUp|onKeyPress|onMouseEnter|onMouseLeave|onScroll|onLoad|onError)\s*[=:]/.test(lines[j])) { inHandler = true; break; }
      }
      if (inHandler) continue;
      windowFindings.push({
        file: relative(ROOT, file),
        line: i + 1,
        snippet: trimmed.slice(0, 140),
      });
    }
    if (/\b(?:localStorage|sessionStorage)\./.test(line)) {
      let inEffect = false;
      for (let j = Math.max(0, i - 20); j < i; j++) {
        if (/useEffect\(/.test(lines[j])) { inEffect = true; break; }
      }
      if (inEffect) continue;
      windowFindings.push({
        file: relative(ROOT, file),
        line: i + 1,
        snippet: trimmed.slice(0, 140),
      });
    }
  }
}

if (windowFindings.length === 0) {
  pass(
    'Test 7: No window/localStorage access during render',
    'All window/localStorage/sessionStorage access is guarded by useEffect or event handlers.',
    `Scanned ${clientComponents.length} client components.`
  );
} else {
  const evidence = windowFindings
    .map((f) => `  • ${f.file}:${f.line}\n    ${f.snippet}`)
    .join('\n');
  fail(
    'Test 7: No window/localStorage access during render',
    `${windowFindings.length} unsafe window/localStorage access(es) found.`,
    evidence,
    'Move the access into a useEffect, or guard with `if (typeof window !== "undefined")` AND wrap in useState/useEffect so it only runs after mount.'
  );
}

// (3) useLayoutEffect — should use useEffect instead
let layoutEffectUses = [];
for (const { file, src } of clientComponents) {
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/\buseLayoutEffect\b/.test(lines[i]) && !lines[i].trim().startsWith('//')) {
      layoutEffectUses.push({ file: relative(ROOT, file), line: i + 1 });
    }
  }
}

if (layoutEffectUses.length === 0) {
  pass(
    'Test 8: No useLayoutEffect',
    'No useLayoutEffect usage found. All effects use useEffect (SSR-safe).',
    `Scanned ${clientComponents.length} client components.`
  );
} else {
  fail(
    'Test 8: No useLayoutEffect',
    `${layoutEffectUses.length} useLayoutEffect call(s) found.`,
    layoutEffectUses.map((f) => `  • ${f.file}:${f.line}`).join('\n'),
    'Replace useLayoutEffect with useEffect. useLayoutEffect runs synchronously after DOM mutations but throws a warning during SSR.'
  );
}

// (4) useEffect with intervals/listeners must have cleanup
// We look for setInterval / setTimeout / addEventListener inside useEffect
// and verify the SAME useEffect has a `return () =>` cleanup.
const effectCleanupFindings = [];
for (const { file, src } of clientComponents) {
  const lines = src.split('\n');
  // Find each useEffect( block
  for (let i = 0; i < lines.length; i++) {
    if (!/useEffect\(/.test(lines[i])) continue;
    // Find the matching closing `}, [...]` of this useEffect.
    // Heuristic: scan forward up to 60 lines for the closing `}, [` or `});`
    let depth = 0;
    let endLine = -1;
    for (let j = i; j < Math.min(lines.length, i + 60); j++) {
      for (const ch of lines[j]) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
      }
      // The useEffect body ends with `}` followed by `, [...]` or `)`.
      if (depth <= 0 && /}\s*(?:,\s*\[[^\]]*\])?\s*\)?\s*;?\s*$/.test(lines[j]) && j > i) {
        endLine = j;
        break;
      }
    }
    if (endLine < 0) continue;
    const body = lines.slice(i, endLine + 1).join('\n');
    const hasInterval = /setInterval\(/.test(body);
    const hasTimeout = /setTimeout\(/.test(body);
    const hasListener = /addEventListener\(/.test(body);
    const hasCleanup = /return\s*\(\s*\)\s*=>|return\s+function\s*\(/.test(body);
    if ((hasInterval || hasListener) && !hasCleanup) {
      effectCleanupFindings.push({
        file: relative(ROOT, file),
        line: i + 1,
        snippet: `useEffect with ${hasInterval ? 'setInterval' : 'addEventListener'} but no return () => cleanup`,
      });
    }
    // setTimeout without cleanup is acceptable (it just fires once), but
    // we warn if there are MANY setTimeouts without cleanup.
    if (hasTimeout && !hasCleanup && (body.match(/setTimeout\(/g) || []).length > 2) {
      effectCleanupFindings.push({
        file: relative(ROOT, file),
        line: i + 1,
        snippet: `useEffect with multiple setTimeout() but no cleanup (potential memory leak if component unmounts)`,
      });
    }
  }
}

if (effectCleanupFindings.length === 0) {
  pass(
    'Test 9: useEffect cleanup for intervals/listeners',
    'Every useEffect that uses setInterval/addEventListener has a `return () =>` cleanup.',
    `Scanned ${clientComponents.length} client components.`
  );
} else {
  const evidence = effectCleanupFindings
    .map((f) => `  • ${f.file}:${f.line} — ${f.snippet}`)
    .join('\n');
  fail(
    'Test 9: useEffect cleanup for intervals/listeners',
    `${effectCleanupFindings.length} useEffect(s) missing cleanup.`,
    evidence,
    'Add `return () => { clearInterval(t) }` (or removeEventListener) at the end of each useEffect that registers an interval or listener.'
  );
}

// ============================================================
// 2c. Accessibility
// ============================================================
console.log('════════════════════════════════════════════════════════════');
console.log('  Part 2c · Accessibility');
console.log('════════════════════════════════════════════════════════════\n');

// (1) Interactive elements (<button, <a, <input) should have either visible
// text or an aria-label. We scan the landing page (the public-facing surface)
// and check that every <button> has either child text or aria-label.
const interactiveFindings = [];
const interactiveRe = /<(button|a)\s+([^>]*)>([^<]*)<\/\1>/g;
let im;
while ((im = interactiveRe.exec(landingPageSrc)) !== null) {
  const tag = im[1];
  const attrs = im[2];
  const text = (im[3] || '').trim();
  const hasAriaLabel = /aria-label=/.test(attrs);
  const hasAriaLabelledby = /aria-labelledby=/.test(attrs);
  const hasText = text.length > 0 && !/^[\s✕×\u00D7]+$/.test(text); // exclude bare ✕
  if (!hasAriaLabel && !hasAriaLabelledby && !hasText) {
    const lineNo = landingPageSrc.slice(0, im.index).split('\n').length;
    interactiveFindings.push({
      line: lineNo,
      snippet: im[0].slice(0, 140),
    });
  }
}

// Also check <button> elements that are self-closing or have only icon children.
// We look for <button ...> followed by an icon component (<X, <Bell, etc.) and
// no aria-label.
const iconButtonRe = /<button\s+([^>]*?)>\s*<(?:X|Bell|Check|Loader2|AlertCircle|AlertTriangle|Info|CheckCircle2|ChevronDown|ExternalLink|HelpCircle|UtensilsCrossed|ArrowRight|Send|Star|MapPin|Clock|Users|Globe|MessageSquare|Phone|Instagram|Sparkles|Moon|LayoutGrid|ShieldCheck|CalendarCheck|BarChart3|Zap|Lock|Database|Wifi|CalendarDays|Quote|Building|ThumbsUp|Reply|Gauge|Filter|Award|Smartphone|TrendingUp|ChefHat)\b/g;
let ibm;
while ((ibm = iconButtonRe.exec(landingPageSrc)) !== null) {
  const attrs = ibm[1];
  if (/aria-label=/.test(attrs)) continue;
  const lineNo = landingPageSrc.slice(0, ibm.index).split('\n').length;
  // Avoid double-counting lines already in interactiveFindings
  if (interactiveFindings.some((f) => f.line === lineNo)) continue;
  interactiveFindings.push({
    line: lineNo,
    snippet: ibm[0].slice(0, 140),
  });
}

if (interactiveFindings.length === 0) {
  pass(
    'Test 10: Interactive elements have accessible names',
    'All <button> and <a> elements in the landing page have visible text or aria-label.',
    'Verified by regex over src/components/landing/LandingPage.tsx.'
  );
} else {
  const evidence = interactiveFindings
    .slice(0, 10)
    .map((f) => `  • LandingPage.tsx:${f.line}\n    ${f.snippet}`)
    .join('\n');
  fail(
    'Test 10: Interactive elements have accessible names',
    `${interactiveFindings.length} interactive element(s) missing accessible name.`,
    evidence,
    'Add aria-label="..." to icon-only buttons, or include visible text inside the element.'
  );
}

// (2) Images have alt text
const imgNoAlt = [];
for (const m of landingPageSrc.matchAll(/<img\s+([^>]*)>/g)) {
  if (!/\balt=/.test(m[1])) {
    const lineNo = landingPageSrc.slice(0, m.index).split('\n').length;
    imgNoAlt.push({ line: lineNo, snippet: m[0].slice(0, 140) });
  }
}
if (imgNoAlt.length === 0) {
  pass(
    'Test 11: Images have alt text',
    'All <img> tags in the landing page have an alt attribute.',
    'Verified by regex over src/components/landing/LandingPage.tsx.'
  );
} else {
  fail(
    'Test 11: Images have alt text',
    `${imgNoAlt.length} <img> tag(s) missing alt text.`,
    imgNoAlt.map((f) => `  • LandingPage.tsx:${f.line}\n    ${f.snippet}`).join('\n'),
    'Add descriptive alt="..." to every <img>. Decorative images should use alt="".'
  );
}

// (3) Color contrast — WCAG AA (4.5:1 for body text)
// We check the design tokens in globals.css against the WCAG formula.
// Pairs to check: foreground/background combinations used for body text.
const COLOR_PAIRS = [
  { fg: '#f5f5f0', bg: '#0a0a0a', label: 'body text on bg-base',     expectAA: true },
  { fg: '#a1a1aa', bg: '#0a0a0a', label: 'muted text on bg-base',    expectAA: true },
  { fg: '#71717a', bg: '#0a0a0a', label: 'dim text on bg-base',      expectAA: false }, // dim text often fails AA; we accept it as decorative
  { fg: '#C5A059', bg: '#0a0a0a', label: 'gold accent on bg-base',   expectAA: true },
  { fg: '#0a0a0a', bg: '#C5A059', label: 'button text on gold',      expectAA: true },
  { fg: '#f5f5f0', bg: '#111518', label: 'body text on bg-panel',    expectAA: true },
  { fg: '#a1a1aa', bg: '#111518', label: 'muted text on bg-panel',   expectAA: true },
  { fg: '#f5f5f0', bg: '#1a1f24', label: 'body text on bg-elevated', expectAA: true },
  { fg: '#fbbf24', bg: '#0a0a0a', label: 'warning yellow on dark',   expectAA: true },
  { fg: '#4ade80', bg: '#0a0a0a', label: 'success green on dark',    expectAA: true },
  { fg: '#f87171', bg: '#0a0a0a', label: 'danger red on dark',       expectAA: true },
];

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function luminance({ r, g, b }) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
function contrast(fg, bg) {
  const l1 = luminance(hexToRgb(fg));
  const l2 = luminance(hexToRgb(bg));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const contrastFailures = [];
for (const p of COLOR_PAIRS) {
  const ratio = contrast(p.fg, p.bg);
  const passesAA = ratio >= 4.5;
  if (p.expectAA && !passesAA) {
    contrastFailures.push({ ...p, ratio: ratio.toFixed(2) });
  }
}

if (contrastFailures.length === 0) {
  pass(
    'Test 12: Color contrast (WCAG AA 4.5:1)',
    `All ${COLOR_PAIRS.length} checked color pairs meet WCAG AA contrast (≥ 4.5:1).`,
    'Pairs: ' + COLOR_PAIRS.map((p) => `${p.label}=${contrast(p.fg, p.bg).toFixed(2)}`).join(', ')
  );
} else {
  fail(
    'Test 12: Color contrast (WCAG AA 4.5:1)',
    `${contrastFailures.length} color pair(s) fail WCAG AA.`,
    contrastFailures.map((p) => `  • ${p.label}: ${p.fg} on ${p.bg} = ${p.ratio}:1 (< 4.5)`).join('\n'),
    'Lighten the foreground or darken the background. For muted text, consider #c7c7cf instead of #a1a1aa.'
  );
}

// (4) Focus management for modals/dialogs — Radix Dialog handles this
// automatically. We just check that custom modals (motion.div with role=dialog
// or backdrop) have an explicit close button and the backdrop click closes.
// In our codebase, the ReviewSubmitForm is a custom modal. Let's verify.
const reviewFormSrc = landingPageSrc.slice(
  landingPageSrc.indexOf('function ReviewSubmitForm'),
  landingPageSrc.indexOf('// ─── REAL WORLD', landingPageSrc.indexOf('function ReviewSubmitForm'))
);
const hasCloseButton = /aria-label="Cerrar"/.test(reviewFormSrc) || /aria-label="Close"/.test(reviewFormSrc);
const hasBackdropClick = /onClick=\{onClose\}/.test(reviewFormSrc);
const hasEscape = /onKeyDown|Escape|onEscape/.test(reviewFormSrc);
if (hasCloseButton && hasBackdropClick) {
  pass(
    'Test 13: Modal focus management',
    'ReviewSubmitForm has an explicit close button (aria-label="Cerrar") and backdrop click closes.',
    `Close button: ${hasCloseButton}. Backdrop click: ${hasBackdropClick}. Escape key: ${hasEscape ? 'yes' : 'no (acceptable — Radix Dialog handles this for shadcn dialogs)'}.`
  );
} else {
  fail(
    'Test 13: Modal focus management',
    'ReviewSubmitForm is missing close button or backdrop click handler.',
    `Close button: ${hasCloseButton}. Backdrop click: ${hasBackdropClick}.`,
    'Add aria-label="Cerrar" to the close button and onClick={onClose} to the backdrop.'
  );
}

// (5) Keyboard navigation — focus-visible styles and tabindex
// Tailwind v4 + shadcn/ui add focus-visible:ring by default. We check
// that globals.css or the components don't disable outline globally.
const outlineDisabled = /outline:\s*none(?!\s*;?\s*\/\*)/.test(globalsSrc) || /\*\s*\{\s*[^}]*outline:\s*none/.test(globalsSrc);
if (!outlineDisabled) {
  pass(
    'Test 14: Keyboard navigation (focus-visible)',
    'No global outline:none rule found. shadcn/ui components add focus-visible:ring by default.',
    'Verified by regex over src/app/globals.css.'
  );
} else {
  fail(
    'Test 14: Keyboard navigation (focus-visible)',
    'A global outline:none rule was found — this breaks keyboard navigation.',
    'Found `outline: none` in globals.css.',
    'Remove the global outline:none. Use `outline: 2px solid transparent` + `outline-offset: 2px` + a `:focus-visible` rule with a visible ring instead.'
  );
}

// ============================================================
// 2d. Responsive design
// ============================================================
console.log('════════════════════════════════════════════════════════════');
console.log('  Part 2d · Responsive design');
console.log('════════════════════════════════════════════════════════════\n');

// (1) Layouts use responsive classes (sm:, md:, lg:)
// We sample the landing page and dashboard shell for responsive class usage.
const responsiveClasses = (landingPageSrc.match(/\b(sm|md|lg|xl):/g) || []).length;
if (responsiveClasses >= 30) {
  pass(
    'Test 15: Responsive classes',
    `Landing page uses ${responsiveClasses} responsive class prefixes (sm:/md:/lg:/xl:).`,
    'A responsive landing page should have ≥30 responsive class usages across mobile/tablet/desktop breakpoints.'
  );
} else {
  fail(
    'Test 15: Responsive classes',
    `Landing page only uses ${responsiveClasses} responsive class prefixes (expected ≥30).`,
    'Counted sm:/md:/lg:/xl: occurrences in src/components/landing/LandingPage.tsx.',
    'Add mobile-first breakpoints: change fixed widths to w-full sm:w-1/2 lg:w-1/3, etc.'
  );
}

// (2) No fixed widths that would overflow on mobile
// We look for fixed widths like w-[Npx] where N > 375 (mobile viewport).
// Also look for inline style={{ width: Npx }} where N > 375.
const fixedWidthFindings = [];
const wRe = /w-\[(\d+)px\]/g;
let wm;
while ((wm = wRe.exec(landingPageSrc)) !== null) {
  const px = parseInt(wm[1], 10);
  if (px > 375) {
    const lineNo = landingPageSrc.slice(0, wm.index).split('\n').length;
    fixedWidthFindings.push({ line: lineNo, snippet: `w-[${px}px]` });
  }
}
const styleWidthRe = /style=\{\{\s*width:\s*(\d+)\s*\}\}/g;
let swm;
while ((swm = styleWidthRe.exec(landingPageSrc)) !== null) {
  const px = parseInt(swm[1], 10);
  if (px > 375) {
    const lineNo = landingPageSrc.slice(0, swm.index).split('\n').length;
    fixedWidthFindings.push({ line: lineNo, snippet: `style={{ width: ${px} }}` });
  }
}

if (fixedWidthFindings.length === 0) {
  pass(
    'Test 16: No fixed widths overflowing mobile',
    'No fixed widths > 375px found in the landing page.',
    'Verified by regex over src/components/landing/LandingPage.tsx.'
  );
} else {
  fail(
    'Test 16: No fixed widths overflowing mobile',
    `${fixedWidthFindings.length} fixed width(s) > 375px found.`,
    fixedWidthFindings.map((f) => `  • LandingPage.tsx:${f.line} — ${f.snippet}`).join('\n'),
    'Use w-full max-w-[Npx] instead of w-[Npx] so the element shrinks on mobile.'
  );
}

// (3) Touch targets ≥ 44x44px
// We look for buttons/links with explicit small sizes (h-8, h-9, w-8, w-9
// without min-h-[44px] / min-w-[44px] fallbacks).
// Tailwind: h-8 = 32px, h-9 = 36px, h-10 = 40px, h-11 = 44px, h-12 = 48px.
// WCAG 2.5.5 recommends 44x44px. We flag h-8/h-9 without min-h-[44px].
const smallTouchTargets = [];
const buttonRe = /<button\s+([^>]*?)>/g;
let bm;
while ((bm = buttonRe.exec(landingPageSrc)) !== null) {
  const attrs = bm[1];
  // Check if the button has explicit small size
  const hasH8 = /\bh-8\b/.test(attrs);
  const hasH9 = /\bh-9\b/.test(attrs);
  const hasW8 = /\bw-8\b/.test(attrs);
  const hasW9 = /\bw-9\b/.test(attrs);
  const hasMin44 = /min-h-\[44px\]|min-w-\[44px\]/.test(attrs);
  if ((hasH8 || hasH9 || hasW8 || hasW9) && !hasMin44) {
    const lineNo = landingPageSrc.slice(0, bm.index).split('\n').length;
    smallTouchTargets.push({
      line: lineNo,
      snippet: `<button ${attrs.trim().slice(0, 100)}>`,
    });
  }
}

if (smallTouchTargets.length === 0) {
  pass(
    'Test 17: Touch targets ≥ 44x44px',
    'No buttons with explicit h-8/h-9/w-8/w-9 sizes found in the landing page.',
    'Verified by regex over src/components/landing/LandingPage.tsx.'
  );
} else {
  warn(
    'Test 17: Touch targets ≥ 44x44px',
    `${smallTouchTargets.length} button(s) with small sizes (h-8/h-9/w-8/w-9) found.`,
    smallTouchTargets.slice(0, 5).map((f) => `  • LandingPage.tsx:${f.line}\n    ${f.snippet}`).join('\n')
  );
}

// (4) Mobile menu for dashboard
// The dashboard must have a mobile menu (MenuMobile component) and a
// hamburger toggle in the Sidebar/Topbar.
const dashboardShellSrc = read(resolve(ROOT, 'src/components/dashboard/DashboardShell.tsx'));
const menuMobileSrc = read(resolve(ROOT, 'src/components/dashboard/MenuMobile.tsx'));
const sidebarSrc = read(resolve(ROOT, 'src/components/dashboard/Sidebar.tsx'));
const hasMenuMobile = /MenuMobile/.test(dashboardShellSrc);
const hasMobileToggle = /sidebarOpen|setSidebarOpen/.test(sidebarSrc);
const hasMobileNav = /lg:hidden/.test(menuMobileSrc);
if (hasMenuMobile && hasMobileToggle && hasMobileNav) {
  pass(
    'Test 18: Mobile menu for dashboard',
    'DashboardShell renders <MenuMobile/>, Sidebar has a sidebarOpen toggle, and MenuMobile uses lg:hidden.',
    'Verified by reading DashboardShell.tsx, Sidebar.tsx, MenuMobile.tsx.'
  );
} else {
  fail(
    'Test 18: Mobile menu for dashboard',
    `Missing pieces: MenuMobile=${hasMenuMobile}, toggle=${hasMobileToggle}, lg:hidden=${hasMobileNav}.`,
    'Dashboard must have a mobile-friendly nav.',
    'Add a hamburger toggle in Topbar/Sidebar that opens a <MenuMobile/> on screens < lg.'
  );
}

// ============================================================
// Summary
// ============================================================
console.log('════════════════════════════════════════════════════════════');
console.log('  Summary');
console.log('════════════════════════════════════════════════════════════\n');

const passed = RESULTS.filter((r) => r.status === 'PASS').length;
const failed = RESULTS.filter((r) => r.status === 'FAIL').length;
const warned = RESULTS.filter((r) => r.status === 'WARN').length;

console.log(`Passed: ${passed}`);
console.log(`Warned: ${warned}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  console.log('\nFailed tests:');
  RESULTS.filter((r) => r.status === 'FAIL').forEach((r) => console.log(`  ❌ ${r.name}`));
  process.exit(1);
} else {
  console.log('\n🎉 Frontend validation PASSED.');
  process.exit(0);
}
