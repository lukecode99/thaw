# Export compliance (encryption)

## What this app ships

Thaw applies end-to-end encryption to user content as its core function:
entries are sealed on-device with XChaCha20-Poly1305, keys are derived with
HKDF-SHA256 from a pair root key established during device pairing, and the
relay only ever stores ciphertext. This is encryption applied by the app
itself to user data — it is **not** limited to Apple's exempt categories
(HTTPS/TLS calls made by the OS), so the app **uses non-exempt encryption**.

## App Store declaration

`ITSAppUsesNonExemptEncryption` is set to **YES** in `app.json`
(`expo.ios.infoPlist`) and verified in the iOS workflow before every build.
Note this is the opposite of the estate default (other apps in this account
set it to `false` because they only use TLS) — do not "fix" it to match them.

Because the flag is YES, App Store Connect asks the export-compliance
questions once per app (or expects `ITSEncryptionExportComplianceCode` once a
compliance code is issued). Answers for this app:

- Uses encryption: **yes**
- Qualifies for exemption: **no** (proprietary use of standard algorithms for
  user content, not just TLS)
- Available in France: standard French declaration flow applies if we ship
  there; revisit at App Store (non-TestFlight) release.

## U.S. EAR classification

The app implements standard, published cryptography (XChaCha20-Poly1305,
HKDF-SHA256 via the open-source `@noble` libraries) in a mass-market consumer
app. Self-classified **5D992.c**, exported under **License Exception ENC,
15 CFR §740.17(b)(1)** — self-classifiable, no one-time review required.

## Annual reminder (do not delete)

License Exception ENC §740.17(b)(1) requires an **annual self-classification
report** to BIS for products exported during the prior calendar year:

- Due **by February 1** each year, covering the previous calendar year.
- Email the report (CSV per Supplement No. 8 to Part 742) to
  `crypt@bis.doc.gov` and `enc@nsa.gov`.
- First report due **1 February 2027** (for 2026 exports), assuming the app
  ships to TestFlight/App Store in 2026.

Owner: whoever cuts the release. Put it in the calendar when the first
TestFlight build goes out.
