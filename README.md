# VoxSculpt

**Hands-first 3D voxel sculpting in your living room.**  
Build with your bare hands in mixed reality — no controllers, no tutorials, just pinch and place.

🔗 **[Live Demo → gatlavishweshwarreddy.github.io/voxsculpt/](https://gatlavishweshwarreddy.github.io/voxsculpt/)**

---

## What it is

VoxSculpt is a WebXR mixed-reality experience for **Meta Quest** that turns your physical room into a 3D sculpting studio. Floating voxel blocks snap to an invisible 8 cm grid in the space around you. Reach out, pinch a color from the wrist palette, and start building — no menu, no onboarding, no controller in your hand.

Designed for the **Meta VR Start Developer Competition 2026**.

---

## How it works

When you enter XR, VoxSculpt overlays a passthrough view of your real room with interactive voxel blocks managed by an Entity-Component System (ECS). Every interaction is driven by hand-tracking data from the WebXR Hand Input API:

1. **Hand pose detection** — `XRHandVisualAdapter.getPinchStrength()` measures the distance between your thumb tip and index tip in real time (0 → 1). A reading above 0.85 commits a pinch.
2. **Grid snapping** — Your hand's world-space position is rounded to the nearest 8 cm grid cell (`Math.round(pos / 0.08)`), giving the satisfying clunk of LEGO-style placement.
3. **Preview entity** — While you hold a pinch, a semi-transparent ghost voxel follows your hand and snaps to each cell. It turns red if the cell is already occupied.
4. **Placement** — Releasing the pinch below the 1 m/s throw threshold places the voxel permanently and fires a pop-particle effect.
5. **Color ring** — Eight emissive spheres orbit your left wrist. Touch one with your right index tip to change the active brush color instantly.
6. **Undo stack** — Up to 32 actions are recorded. Pinch both hands simultaneously, hold for 150 ms, then release both to pop the last action.
7. **Export** — `GLTFExporter` serializes all placed voxels into a self-contained `.gltf` file downloaded to your device.

---

## Hand gestures

| Gesture | How to do it | What happens |
|---|---|---|
| **Place voxel** | Pinch (index + thumb), hold, release slowly | Ghost appears → snaps to grid → placed on release |
| **Choose color** | Move right index tip into a wrist swatch | Active color changes, swatch glows brighter |
| **Delete voxel** | Pinch near a voxel and release with a fast flick (>1 m/s) | Nearest voxel within 32 cm is removed |
| **Undo** | Pinch both hands at once, hold ≥150 ms, release both | Last place or delete is reversed |
| **Export** | Ray-click "Export .gltf" on the HUD panel | `.gltf` file downloads to your device |
| **Clear all** | Ray-click "Clear" on the HUD panel | All voxels removed |

> **No controller fallback by design.** Hands-first is mandatory for the competition.

---

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | [Meta Immersive Web SDK (IWSDK)](https://iwsdk.dev) 1.0 RC |
| XR | WebXR Device API — `immersive-ar` + `hand-tracking` |
| ECS | IWSDK elics 3.4 (`createSystem`, `createComponent`) |
| 3D | Three.js (via `@iwsdk/core`) — procedural `BoxGeometry` voxels |
| UI | UIKitML (`@pmndrs/uikit-horizon`) floating panel |
| Export | `three/addons/exporters/GLTFExporter` (dynamic import) |
| Build | Vite 7 + TypeScript 5.5 |
| Target | Meta Quest 3 / 3S, 72–90 fps |

---

## Project structure

```
src/
├── index.ts                        World entry point, system registration
├── components.ts                   ECS component manifest (editor + runtime)
├── voxel-components.ts             VoxelBlock, ColorSwatch, VoxelSculptor, FeedbackParticle
├── voxel-constants.ts              Grid math, VOXEL_SIZE, MAX_VOXELS
├── assets.ts                       Asset manifest (procedural Object3Ds + UIKitML HUD)
├── panel.ts                        XR launch/exit wired to HUD panel
├── scene-assets/
│   ├── voxel.scene-asset.ts        BoxGeometry + edge-highlight prototype
│   ├── palette.scene-asset.ts      8 emissive swatch sphere prototypes
│   └── particle.scene-asset.ts     Pop-feedback sphere prototype
└── systems/
    ├── sculptor-spawn-system.ts    Spawns singleton VoxelSculptor state entity
    ├── hand-sculpt-system.ts       Core loop: pinch → preview → place / delete
    ├── color-palette-system.ts     Wrist-anchored palette ring + touch detection
    ├── voxel-feedback-system.ts    Pop-and-rise particle animation
    ├── undo-system.ts              Dual-pinch gesture → undo stack pop
    ├── export-system.ts            GLTFExporter → browser download
    └── hud-system.ts               Floating HUD: count display, button wiring

public/
├── scenes/main.iwsdk.scene.json    Scene: dark IBL + HUD panel node
└── ui/voxsculpt-hud.uikitml        UIKitML panel markup and styles
```

---

## Run locally

**Requirements:** Node.js ≥ 20.19, npm

```bash
# Install dependencies
npm install

# Start the IWSDK dev server (opens managed Chromium)
npm run dev
```

The IWSDK CLI launches a Chromium window with the IWER browser emulator. Click **Enter XR** on the panel to enter immersive mode.

### Emulator quick-test (no headset needed)

1. In the **Controller Panel** → **Right Hand** tab, set `X: 0.3  Y: 1.2  Z: -0.3`.
2. Press and **hold** the **Trigger** button — a semi-transparent ghost voxel appears.
3. **Release** the Trigger — voxel places, HUD counter increments to `1 voxels`.
4. To test color: set **Left Hand** to `X: -0.2  Y: 1.2  Z: -0.3`, then move the right hand within 4 cm of any swatch sphere.
5. To test undo: hold **both** Triggers for >150 ms, then release both — the last voxel disappears.

### Build for production / GitHub Pages

```bash
node node_modules/vite/dist/node/cli.js build
# Output in dist/ — served under /voxsculpt/ base path
```

### Typecheck

```bash
npm run typecheck
```

---

## Testing on a real Meta Quest

1. Start the dev server: `npm run dev`
2. Run `npx @iwsdk/cli dev status` and find a URL under `runtimeUrls.network`.
3. Open that URL in the Meta Quest browser.
4. Accept the local certificate warning (expected — dev cert).
5. Tap **Enter XR** and sculpt.

Full workflow: [IWSDK — Testing Your Experience](https://iwsdk.dev/guides/02-testing-experience.html)

---

## Competition context

VoxSculpt was built for the **Meta VR Start Developer Competition 2026**.

| Criterion | Approach |
|---|---|
| **Innovation (25%)** | Hands-only sculpting — no controller, no UI menus; the wrist palette and throw-to-delete are novel interaction patterns for WebXR |
| **Experience Design (25%)** | Zero tutorial — every gesture is instinctive. Works seated in a 2-foot radius. Complete creative loop in under 10 minutes |
| **Technical Implementation (25%)** | Full ECS architecture, procedural assets, grid snapping, undo stack, live GLTF export, 60 fps voxel budget |
| **Polish (25%)** | Pop particles on every interaction, edge-highlighted voxels, emissive palette ring, red occupied-cell warning, dark-glass HUD |

---

## License

MIT — see [LICENSE](LICENSE).
