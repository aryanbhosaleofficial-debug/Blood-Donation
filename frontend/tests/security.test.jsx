import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function findFiles(dir, filter) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(filePath, filter));
    } else if (filter(filePath)) {
      results.push(filePath);
    }
  }
  return results;
}

describe('Frontend never carries backend secrets (Supabase / Gemini)', () => {
  const frontendRoot = path.resolve(__dirname, '..');
  const repoRoot = path.resolve(__dirname, '../..');

  // Names/prefixes that must NEVER exist in frontend code or its build output.
  const FORBIDDEN = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'VITE_SUPABASE_SERVICE_ROLE_KEY',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_GEMINI_API_KEY',
    'GEMINI_API_KEY',
    'service_role',
  ];

  it('no frontend source or env file references a Supabase/Gemini secret', () => {
    const files = [
      ...findFiles(path.join(frontendRoot, 'src'), (f) => /\.(js|jsx|ts|tsx|json)$/.test(f)),
      ...['index.html', '.env', '.env.local', '.env.production']
        .map((f) => path.join(frontendRoot, f))
        .filter((f) => fs.existsSync(f)),
    ];
    const hits = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      for (const needle of FORBIDDEN) {
        if (content.includes(needle)) hits.push(`${file} :: ${needle}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('frontend package.json does not depend on supabase-js or the Gemini SDK', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(frontendRoot, 'package.json'), 'utf8'));
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    expect(deps['@supabase/supabase-js']).toBeUndefined();
    expect(deps['@google/genai']).toBeUndefined();
  });

  it('if a production build exists, its bundle contains no secret material', () => {
    const distDir = path.join(frontendRoot, 'dist');
    if (!fs.existsSync(distDir)) {
      // Build not present in this run — the source + package checks above still apply.
      return;
    }
    const assets = findFiles(distDir, (f) => /\.(js|css|html|map)$/.test(f));
    expect(assets.length).toBeGreaterThan(0);
    const hits = [];
    // Real secret values are long random strings; we check for the *names* and
    // for obvious key shapes (Google API keys start with "AIza").
    const patterns = [...FORBIDDEN, 'AIza'];
    for (const file of assets) {
      const content = fs.readFileSync(file, 'utf8');
      for (const needle of patterns) {
        if (content.includes(needle)) hits.push(`${path.basename(file)} :: ${needle}`);
      }
    }
    expect(hits).toEqual([]);
  });
});

describe('Frontend Codebase Security & XSS Invariant', () => {
  it('ensures no React source file assigns innerHTML or insertAdjacentHTML or dangerouslySetInnerHTML', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const sourceFiles = findFiles(srcDir, (f) => f.endsWith('.js') || f.endsWith('.jsx'));

    expect(sourceFiles.length).toBeGreaterThan(10);

    const violations = [];
    const unsafeRegex = /(\.innerHTML\s*=|\.insertAdjacentHTML\s*\(|dangerouslySetInnerHTML)/;

    for (const filePath of sourceFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (unsafeRegex.test(content)) {
        violations.push(filePath);
      }
    }

    expect(violations).toEqual([]);
  });
});
