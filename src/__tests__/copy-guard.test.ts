import * as fs from 'fs';
import * as path from 'path';

// App Store guideline 1.4.1: this product is a communication tool, never a
// medical one. These words must not appear anywhere in code or copy.
const BANNED = [
  /\btherapy\b/i,
  /\btherapists?\b/i,
  /\bcounsell?ing\b/i,
  /\btreatment\b/i,
  /\bdiagnos\w*\b/i,
  /\bmental health\b/i,
  /\bclinically proven\b/i,
  /\bheal(?:s|ed|ing)?\b/i, // word-bounded so "health" in identifiers stays legal
];

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(tsx?|jsx?|json|md)$/.test(entry.name) ? [full] : [];
  });
}

describe('banned-words guard', () => {
  const root = path.resolve(__dirname, '..', '..');
  const files = walk(root);

  test('scans a plausible number of project files', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  test.each(files.map((f) => [path.relative(root, f), f]))('%s is clean', (_rel, full) => {
    const text = fs.readFileSync(full as string, 'utf8');
    for (const pattern of BANNED) {
      // The guard file itself defines the patterns it polices.
      if ((full as string).endsWith('copy-guard.test.ts')) continue;
      expect(text).not.toMatch(pattern);
    }
  });
});
