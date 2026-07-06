# Thaw

*Working title — the name is not final and lives entirely in `src/branding.ts`.*

A two-person app for the moment after an argument. Each partner privately writes
down how it felt, on their own phone. When both have finished, the answers are
revealed together. Nothing is shown early, and nobody goes first.

## The privacy premise

This is the product, not a feature: **everything either partner writes is
end-to-end encrypted on their phone**. The sync relay only ever stores
ciphertext — the keys are created during pairing and never leave the two
devices. There are no accounts, no phone numbers, and no email addresses.
Design decisions that would weaken this (server-side processing of entries,
analytics on content, cloud backups of plaintext) are rejected by default.

## Copy rules

App Store guideline 1.4.1 draws a line between communication tools and medical
products. This app stays firmly on the communication side, so a fixed list of
clinical/medical words is banned from every file in this repo — code, copy,
docs, and configuration. The list itself, and the enforcement, live in
[`src/__tests__/copy-guard.test.ts`](src/__tests__/copy-guard.test.ts); CI
fails if any of those words appear. Write like a calm friend, not a clinic.

## Design system

All visual constants (palette, type scale, spacing, radii) live in
[`src/theme.ts`](src/theme.ts). Screens and components must not contain inline
hex colours — [`src/__tests__/design-guard.test.ts`](src/__tests__/design-guard.test.ts)
enforces it. The palette is calm and warm: soft neutrals with one terracotta
accent, generous whitespace, no gamification.

## Sync relay

`relay/worker.js` is a small Cloudflare Worker + KV namespace that ferries
ciphertext between the two phones. It stores only opaque base64-shaped strings
plus routing metadata (pair id, timestamps) — payloads that look like raw text
or JSON are rejected, bodies are capped at 64 KiB, pairing sessions expire
after 10 minutes, entries after 30 days, and requests are rate-limited per
pair. `src/__tests__/relay-guard.test.ts` pins those properties in CI, and
`relay/integration.test.mjs` exercises the live endpoint:

```bash
RELAY_URL=https://thaw-relay.<subdomain>.workers.dev npm run test:relay
```

Deploys use `wrangler` with credentials from the environment
(`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) — nothing secret is
committed.

## Development

```bash
npm install
npm run web        # dev server in the browser
npm test           # jest
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run build:web  # static web export to dist/
```

## Structure

- `src/branding.ts` — every branding/copy constant (single file to touch on rename)
- `src/theme.ts` — design tokens
- `src/components/` — Button, Card, Input, PromptField
- `src/screens/` — Welcome, Pair, Home, History, Settings
- `src/navigation.ts` — dependency-free navigation state machine
- `relay/` — Cloudflare Worker ciphertext relay + live integration tests
- `.github/workflows/` — web demo deploy, CI checks, iOS build skeleton

## Web demo

Deployed to GitHub Pages from the `gh-pages` branch:
https://lukecode99.github.io/thaw/
