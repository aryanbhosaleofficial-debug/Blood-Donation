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
