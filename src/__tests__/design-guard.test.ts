import * as fs from 'fs';
import * as path from 'path';
import { colors, font, radius, space } from '../theme';

// Success criterion: design tokens live in src/theme.ts and nowhere else —
// no inline hex colours in screens, components, or the app shell.
const HEX = /#[0-9a-fA-F]{3,8}\b/;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('design-token guard', () => {
  const root = path.resolve(__dirname, '..', '..');
  const files = walk(root).filter(
    (f) => !f.endsWith(path.join('src', 'theme.ts')) && !f.includes('__tests__'),
  );

  test('theme.ts is the only home for hex colours', () => {
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      const match = text.match(HEX);
      if (match) {
        throw new Error(`Inline hex ${match[0]} in ${path.relative(root, file)} — use src/theme.ts`);
      }
    }
  });

  test('theme exposes the core token groups', () => {
    expect(Object.keys(colors).length).toBeGreaterThanOrEqual(10);
    expect(space.md).toBeGreaterThan(space.sm);
    expect(space.xl).toBeGreaterThan(space.lg);
    expect(font.size.title).toBeGreaterThan(font.size.md);
    expect(radius.pill).toBeGreaterThan(radius.lg);
  });
});
