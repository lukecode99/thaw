import * as fs from 'fs';
import * as path from 'path';
import * as branding from '../branding';

describe('branding constants', () => {
  test('all copy strings are non-empty', () => {
    for (const [key, value] of Object.entries(branding)) {
      expect(typeof value).toBe('string');
      expect((value as string).length).toBeGreaterThan(0);
      expect(key).toBe(key.toUpperCase());
    }
  });

  test('the app name appears in no other source file as a literal', () => {
    // Rename safety: "Thaw" is a working title and must live only in
    // src/branding.ts (plus static config that cannot import TS).
    const srcRoot = path.resolve(__dirname, '..');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__') walk(full);
        } else if (/\.tsx?$/.test(entry.name) && !full.endsWith('branding.ts')) {
          if (fs.readFileSync(full, 'utf8').includes(`'${branding.APP_NAME}'`)) {
            offenders.push(entry.name);
          }
        }
      }
    };
    walk(srcRoot);
    expect(offenders).toEqual([]);
  });

  test('privacy copy states the encryption premise', () => {
    expect(branding.PRIVACY_LINE).toMatch(/encrypted/i);
    expect(branding.PAIR_EXPLAINER).toMatch(/no accounts/i);
  });
});
