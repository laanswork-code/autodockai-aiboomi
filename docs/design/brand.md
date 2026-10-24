# AutoDock AI design language

Every page of the app follows the look of [autodockai.com](https://autodockai.com/): calm, technical,
editorial. Reference captures are in [`reference/`](reference): `ref-desk-top.png` (hero),
`vs0.jpg` (the seven-step workflow over 3D, with frosted captions), `vs1.jpg` (dark problem
section, cards, technology grid, footer) and `ref-mob-top.png` (phone).

The tokens and primitives live in [`ksum-3d/src/styles/brand.css`](../../ksum-3d/src/styles/brand.css).
The shared header and footer are `SiteHeader` and `SiteFooter` in `ksum-3d/src/Nav.tsx`.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--ad-paper` | `#f1f1f0` | page ground |
| `--ad-panel` | `#fafaf9` | cards, panels |
| `--ad-ink` | `#1a1a1a` | text, primary buttons |
| `--ad-black` | `#0a0a0c` | dark full-bleed sections, footer |
| `--ad-muted` / `--ad-quiet` | `#6e6e6e` / `#8b8b88` | body copy / meta |
| `--ad-line` | `#dcdcda` | hairlines (1px) |
| `--ad-sky` | `#e8f1f6` | occasional pale section wash |
| `--ad-red` | `#ec3013` | rare: live status, alerts, the one thing to look at |
| `--ad-lime` | `#f3feab` | rare: highlight, selection |
| `--ad-sans` | Archivo | all words |
| `--ad-mono` | Geist Mono | labels, nav, buttons, numbers in meta |

## Patterns

- **Headings:** Archivo, light to medium weight (400 to 500), tight tracking (-2%), big and left-aligned.
  Hero `.ad-display`, sections `.ad-h2`, cards `.ad-h3`. Never bold 800 slabs.
- **Section label:** `.ad-label`, a 6px square then mono caps: "■ WORKFLOW". One above each section heading.
- **Body:** 15px Archivo in `--ad-muted`, short measure (60ch). A side note with a 1px left rule: `.ad-note`.
- **Buttons:** `.ad-btn`, square black rectangle (2px radius), mono caps 11px, small ↗. Secondary `.ad-btn--ghost`
  (outlined), on dark `.ad-btn--light`. Rounded `.ad-pill` ("Our products →") for quiet links.
- **Surfaces:** hairline cards (`.ad-card`, 1px `--ad-line`, small radius), media frames with 12px radius,
  frosted caption panels over 3D or video (`.ad-caption`): title in Archivo, step number and meta in mono.
- **Dark sections:** `.ad-dark`, near-black, white type, used for the problem and for emphasis. Footer is dark
  with a giant faded wordmark.
- **Numbers:** tabular, Archivo 500; units and meta in mono caps beside them.
- **Space:** generous. Sections breathe (96 to 160px apart on desktop), gutters `--ad-gutter`.
- **Colour:** grey, black and white carry everything. Red and lime are rationed. The twin's 3D scene keeps its own colours.
- **Motion:** quiet. Fades and short rises with `--ad-ease`; no bounce; respect `prefers-reduced-motion`.

## Rules

- Never write an em dash or any other long dash (see the global rules); the ASCII hyphen is fine.
- Keep every feature and every number; this is a visual and UX revamp, not a content cut.
- Accessibility: visible focus, 4.5:1 contrast for text, real buttons and links, keyboard paths intact.
- Check 1440, 1280, 768 and 390 px wide; nothing clips, overlaps or scrolls sideways.
