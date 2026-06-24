# Development Plan — Procedural 3D Modeler for three.js

> **This is the single source of truth for the project.**
> Read it at the start of every session. **Update it at the end of every session**
> (status checkboxes, the Session Log, and Next Up). Companion docs:
> `PROMPT.md` (vision), `ARCHITECTURE.md` (how it's built).

- **Status:** M5 reached + R3F export target done. Remaining Phase-5 extras: Expression/Random nodes.
- **Last updated:** 2026-06-24
- **Current phase:** Phase 5 extras (Expression + Random nodes) → then Phase 7 launch prep.

---

## How to use this document

1. At session start: read **Current focus** and **Next Up**.
2. During work: check off tasks as completed; add new tasks discovered.
3. At session end (**required**): append a dated entry to the **Session Log**,
   update phase status, update **Next Up**, bump **Last updated**.
4. Architectural decisions → add an ADR in `ARCHITECTURE.md` and link it here.

**Legend:** `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

---

## Milestones (release targets)

| Milestone | Theme | Definition of done |
|---|---|---|
| **M0** | Scaffold | App runs, empty graph + viewport + one primitive node renders. |
| **M1** | Core loop | Node graph ↔ worker eval ↔ viewport, undo/redo, save/load JSON. |
| **M2** | Modeling kit | Primitives + key modifiers + booleans produce real models. |
| **M3** | Codegen MVP | Export clean three.js module; parity test green. |
| **M4** | Parametric | Exposed params, live sliders, parameterized code export. |
| **M5** | Commercial polish | Performance, UX, multi-target export, docs, error handling. |
| **M6** | Launch | Onboarding, examples library, packaging, billing-ready. |

---

## Phase 0 — Planning & Vision  `[x]`
- [x] Define product vision and end-game (`PROMPT.md`)
- [x] Choose architecture & stack (`ARCHITECTURE.md`)
- [x] Establish this development plan as source of truth
- [ ] (optional) Validate stack assumptions with a throwaway spike

## Phase 1 — Foundation (→ M0)  `[x]`
- [x] Scaffold Vite + React + TS (strict) project
- [x] Tooling: ESLint, Prettier, Vitest _(Playwright + CI deferred to Phase 6/CI setup)_
- [x] App shell layout: palette | (graph over viewport) | inspector
- [x] three.js viewport: scene, camera, orbit controls, grid, lighting, resize
- [x] Zustand store skeleton (graph, selection) _(immer middleware; params come in Phase 5)_
- [x] Define core types: `GeometryData`, `Graph`, `NodeDef`, sockets
- [x] Node registry + render nodes (`primitive.box`, `output.mesh`) in React Flow
- [x] Render box geometry in viewport from live graph eval (main thread)
- **Exit criteria (M0):** ✅ add Box + Output, connect them → box renders; inspector
  sliders resize it live. Verified via `npm run typecheck/test/build/lint` (all green)
  and dev-server boot.

## Phase 2 — Core engine loop (→ M1)  `[x]`
- [x] Evaluation engine: DAG build, topo-sort, evaluate to `GeometryData`
- [x] Move evaluation into Web Worker (Comlink) _(buffers structured-cloned for now;_
      _transferables are a Phase 6 perf task — see notes)_
- [x] Content-hash cache (per-node hash incl. upstream hashes) + sweep of stale entries
- [x] Live edit loop: graph change → async worker re-eval → viewport update
- [x] Undo/redo (snapshot history + coalescing for slider/move; Ctrl/Cmd+Z shortcuts)
- [x] Graph serialization: save/load `.graph.json` (version check + unknown-node rejection)
- [x] Node connection validation (type check, self-connect + cycle prevention, UI notice)
- **Exit criteria (M1):** ✅ multi-node graph evaluates in a worker, edits live-update,
  undo/redo works, graph round-trips through JSON. Verified by 11 passing tests +
  typecheck/lint/build (worker code-splits to its own chunk) + dev-server boot.

## Phase 3 — Modeling toolkit (→ M2)  `[~]`
- [x] Node-authoring ergonomics: shared input helpers (`num/bool/str/vec3/geom`,
      `codeArgs`); primitive factory (one impl drives evaluate + codegen in lock-step).
- [x] **Validated geometry-in → geometry-out modifier pattern** end-to-end through the
      engine via the Transform node (the de-risking step for all modifiers/booleans).
- [x] Primitives: box (now factory-based), sphere, cylinder, cone, torus, plane
      _(circle TODO)_
- [x] Transform node (translate / rotate° / scale, per-axis scalar inputs)
- [x] Array (linear + radial; grid TODO) and Mirror — added `mergeGeometriesData` +
      `mirrorGeometry` ops; added `select` inspector control.
- [x] Curves + extrude + lathe/revolve — new **`shape` socket type** + `ShapeData`
      (2D profile). Profile nodes: **Polygon**, **Star**. Generators: **Extrude**
      (THREE.ExtrudeGeometry + bevel), **Lathe** (THREE.LatheGeometry). Profile codegen
      emits `Vector2[]`; generators consume it. _(Freehand curve editing = future.)_
- [x] Booleans via three-bvh-csg (union/subtract/intersect) — `geometry/csg.ts` wrapper;
      **validated the two-geometry-input-socket pattern** through engine + UI.
- [x] Displace (seeded Perlin noise), Twist, Taper deformers — added `deformGeometry`
      op (per-vertex map + normal recompute) and `geometry/noise.ts`. **Bend deferred**
      (math fiddly; tracked below).
- [ ] Bend deformer (deferred from this batch)
- [ ] Subdivide / smooth / bevel
- [ ] Normals + UV utilities, vertex color
- [x] Material node (standard/physical) + assignment — **new `material` socket type +
      `MaterialSpec`**; Output gained a Material input; engine returns `{geometry,
      material}`; viewport builds the three.js material. Inspector got a color control;
      handles render for connectable socket types. See ADR-006.
- **Exit criteria (M2):** ✅ can build non-trivial models end-to-end. Proven by the
  bundled examples (Asteroid, Beveled Gear, Cored Cube) in `src/examples/` + the
  Examples menu, verified by `examples.test.ts`.

## Phase 4 — Code generation MVP (→ M3)  `[x]`
- [x] `CodeFragment` model + import deduping (`codegen/imports.ts`) + helper injection
      (`codegen/helpers.ts`). _(Prettier formatting deferred — output is already clean
      via per-fragment line formatting + indentation; see notes.)_
- [x] `codegen` for every existing node, parity-verified against `evaluate`
- [x] Target A: vanilla three.js ES module export (`generateModule` →
      `export function createModel()` returning a `THREE.Mesh`)
- [x] **Parity test harness:** `runGenerated()` executes the emitted code in-process
      (modules injected, helpers prepended) and asserts positions match `evaluate`
      within epsilon — covers box, all primitives, transform, array (linear+radial),
      mirror, twist/taper/displace, extrude, lathe, boolean (CSG), full pipeline+material.
- [x] Export UI (`ExportPanel`): preview generated code, Copy, Download .ts.
- **Exit criteria (M3):** ✅ export a model → generated module reproduces the viewport
  geometry (proven by the parity suite). Verified by 49 tests + typecheck/lint/build.

## Phase 5 — Parametric system (→ M4)  `[~]`
- [x] Promote any input to an exposed `ExposedParam` — Inspector "expose" toggle;
      `exposeSocket`/`unexposeParam`/`setParamValue`/`renameParam` store actions;
      params dropped when their node is deleted.
- [x] Params panel with live controls (slider/number/color/bool/enum/text) — shared
      `ValueControl` used by Inspector + Params panel; rename, locate-node, remove.
- [x] Param-driven re-eval — engine `resolveInputs` honors param overrides; cache hash
      includes param values (so dragging a param re-evals correctly, worker path).
- [x] Codegen emits `createModel(params = { … })` honoring exposed params (`params.<name>`
      references); `runGenerated` accepts overrides; parity + override tests green.
- [ ] Expression nodes (Monaco) referencing params; seeded random node
- [x] Export target D (graph JSON) — save/load. [x] **Target B (R3F)** — `generateModule`
      gains `target: 'vanilla' | 'r3f'`; R3F emits a `<Model props>` component with a
      `useMemo` building `{geometry, material}` and a `<mesh>`, param props with defaults
      and a value-keyed deps array. Shares the exact build statements with vanilla
      (`functionBody` identical), so geometry is parity-correct by construction.
- **Exit criteria (M4):** ✅ exposed params drive the viewport live and the exported
  `createModel(params)` is runtime-parameterized (proven: override test reproduces an
  eval with that value). Expression nodes + R3F target are the remaining Phase-5 extras.

## Phase 6 — Commercial polish (→ M5)  `[~]`
- [x] Performance: **LOD preview-while-editing** — `quality` ('preview'|'full') threaded
      through `evaluateGraph`/`EvalContext`/worker/`EvalService` (+ cache hash); primitives
      (segment params marked `lod`), Lathe & Extrude cut detail in preview; the hook runs
      preview during rapid edits and a trailing full pass when they settle. Export/codegen
      always 'full'. [ ] worker pool / large-graph profiling.
- [x] Robust error handling + node error surfacing — eval errors keep the **last good
      geometry** (viewport never blanks); failing nodes highlight red in the graph;
      messages in the overlay. ErrorBoundary prevents white-screens.
- [x] glTF/GLB export (Target C) — `export/gltf.ts` + Export panel tabs (Code / glTF).
- [x] UX: node palette **search**; **copy / paste / duplicate** nodes (Ctrl/Cmd+D, +C/+V,
      Inspector Duplicate button). [ ] groups/comments.
- [x] Viewport tools: **wireframe / grid toggles + stats** overlay. [ ] transform gizmos.
- [x] Autosave + local project storage (`state/persistence.ts`) + **New** button.
      [ ] recent files.
- [x] **Resizable / collapsible layout** — `ui/Splitter.tsx` (pointer-capture drag) +
      `ui/useLayout.ts` (persisted sizes/visibility): drag-resize both side panels and the
      graph↔viewport split; collapse each side panel to a reopen rail. Layout persists in
      localStorage.
- [x] Theming/UI polish — SVG icon set (`ui/Icon.tsx`) replacing broken emoji glyphs;
      dark-themed React Flow controls/edges/handles; **material presets library**
      (`material/presets.ts`) via an Inspector preset picker (+ `setNodeValues`);
      **category-colored node headers** (`ui/categoryColors.ts`) + palette dots;
      **branded header** (cube logo); **empty-state** card (quick-start Box→Output / load
      example) + viewport hint; **responsive** breakpoints. [ ] full a11y pass.
- [x] Per-node **tooltips/help** (`NodeDef.description` on all nodes → palette tooltip +
      inspector subtitle). [ ] full user docs.
- **Exit criteria (M5):** ✅ stable, fast, pleasant; no known data-loss/crash bugs.
  Remaining (gizmos, groups, recent files, theming/a11y, full docs) are nice-to-haves.

## Phase 7 — Launch readiness (→ M6)  `[ ]`
- [ ] Onboarding flow + interactive tutorial
- [ ] Example/template library (downloadable starter graphs)
- [ ] Versioned graph format + migration strategy
- [ ] Telemetry (opt-in), error reporting
- [ ] Packaging/deploy (hosting, PWA/offline), billing/licensing hooks
- [ ] Landing page + marketing assets
- **Exit criteria (M6):** publicly usable, monetizable product.

---

## Backlog / future (post-v1)
- Real-time collaboration (CRDT) — architecture left room for it.
- Plugin/SDK for third-party nodes.
- Procedural animation / morph parameters over time.
- Texture/material graph (procedural PBR).
- GPU-accelerated geometry (compute via WebGPU).
- Asset marketplace.

## Known risks & mitigations
- **Codegen↔eval drift** → enforced by parity test harness from M3 onward.
- **Boolean robustness** (web CSG edge cases) → isolate behind wrapper, fixture tests.
- **Main-thread jank on big meshes** → worker eval + transferables + LOD preview.
- **Scope creep** → milestones gate features; non-goals in `PROMPT.md` are firm for v1.

---

## Current focus
Phase 3 — build out the modeling toolkit: more primitives, transforms, arrays, curves,
booleans, deformers (→ M2).

## Next Up (do these next, in order)
1. **Phase 5 extras (remaining):** Expression node (formula referencing params/inputs →
   number) + seeded Random node (deterministic value source). Both are value-producing
   nodes feeding scalar inputs — needs number sockets to be connectable (extend
   `isConnectableType`/handles or a dedicated value-wiring path) — design first.
2. Phase 6 remainder (optional polish): transform gizmos, node groups/comments, recent
   files, theming/responsive/a11y pass, full user docs, worker pool for huge graphs.
3. Codegen polish: Prettier formatting (prettier/standalone); winding-flip in Mirror
   codegen; tree-shakeable named three imports option.
4. Backfill Phase-3 niceties: circle primitive, subdivide/smooth, bend, grid Array,
   vector3 inspector control, vertex color, multi-material output.

## Deferred / tech-debt (carried forward)
- **Transferable GeometryData** across the worker boundary (currently structured-cloned).
  Optimize in Phase 6 perf pass; cache keeps master copies so transfer needs care.
- **CI** (GitHub Actions: typecheck + lint + test) + **Playwright** smoke test — set up
  early in Phase 3 to protect the growing node library.
- Inspector vector3 control still missing (number/slider/checkbox/text/color/select done).
- Param value vs export default are unified for now (editing a param changes its baked
  default). Splitting "preview value" from "exported default" is a future refinement.

---

## Session Log
> Append newest entries at the top. One entry per working session.
> Format: date — what was done — decisions — what's next.

### 2026-06-24 — Layout: resizable + collapsible panels
- **Did:** `Splitter` (pointer-capture drag divider, x/y) + `useLayout` (localStorage-
  persisted `{leftW,rightW,graphH,leftOpen,rightOpen}`). App body is now flex: drag to
  resize the left (Nodes) and right (Properties) panels and the graph↔viewport vertical
  split; collapse either side panel to a slim reopen rail (panel headers got a chevron).
  Center is flex-column (graph fixed height + draggable Y splitter + viewport fills).
  Simplified responsive rules (panels hide < 820px; reopen via rails).
- **Verified:** typecheck, 69 tests, lint, build, dev-boot clean.
- **Next:** Phase-5 deferred (Expression + seeded Random nodes).

### 2026-06-24 — Visual polish: node colors, branding, empty state, responsive
- **Did:** category-colored node headers + glow dot (`ui/categoryColors.ts`; gradient
  title bar via `color-mix`, hover/selected use the category accent) + palette category
  dots; branded header with an inline cube **logo** + tightened typography; **empty-state**
  card on a blank canvas (quick-start "Box → Output" and "Load example") + a viewport hint
  when geometry isn't connected; **responsive** breakpoints (1200/980/760px) shrinking/
  hiding side panels. 69/69 tests green.
- **Verified:** typecheck, 69 tests, lint, build, dev-boot clean.
- **Note:** uses CSS `color-mix()` (broadly supported in modern browsers). Full a11y pass
  (focus rings, ARIA, keyboard nav of the graph) still pending.
- **Next:** Phase-5 deferred (Expression + seeded Random nodes), per plan.

### 2026-06-24 — UI/UX polish: icons, material presets, themed controls
- **Reported:** button glyphs rendered as boxes; no material library; white zoom buttons.
- **Did:**
  - **Icons:** `ui/Icon.tsx` — inline SVG (Feather-style, currentColor) set (new/undo/redo/
    save/load/export/duplicate/delete/locate/remove/circle/search). Replaced all emoji
    glyphs in the toolbar, Inspector (duplicate/delete/expose), and Params panel
    (locate/remove). Generic `.iconbtn` style.
  - **Material presets:** `material/presets.ts` — 15 realistic PBR presets grouped
    (Metal/Plastic/Wood/Mineral/Other). `MaterialPresetPicker` shown on the Material node
    applies a preset via new `setNodeValues(id, values)` store action (single undo step,
    keeps bound params in sync).
  - **Theme:** dark-styled `.react-flow__controls` (was white), edges (muted→accent on
    hover/selected), connection line, handles; toolbar icon coloring.
  - Tests: +2 presets. 68/68 green.
- **Verified:** typecheck, 68 tests, lint, build, dev-boot clean.
- **Next:** further polish as desired (responsive/a11y, node-graph visuals) or Phase 7.

### 2026-06-24 — Phase 5 extra: R3F export target (B)
- **Did:** `generateModule(graph, { target })` now supports `'vanilla' | 'r3f'`.
  R3F emits `import { useMemo } from 'react'`, an `export function Model(props = {})` that
  merges `props` over defaults, a `useMemo` building `{ geometry, material }` (same
  statements as vanilla) keyed on the param values, and returns `<mesh geometry material/>`.
  Export panel got a **target selector** (vanilla three.js / React Three Fiber) with
  `.ts`/`.tsx` download. `CodegenResult.target` added.
- **Key design:** both targets share the identical runnable `functionBody` (mesh-returning)
  used by the parity harness, so R3F geometry is **correct by construction** — no separate
  parity needed. Tests assert R3F structure + that `functionBody`/`paramDefaults` equal the
  vanilla target (and that body is parity-verified).
- **Verified:** typecheck, 67 tests, lint, build; eyeballed the gear example's R3F output
  (clean, memoized, renders `<mesh>`).
- **Next:** Expression + seeded Random nodes (the last Phase-5 extras).

### 2026-06-24 — Phase 6 batch 2: LOD, copy/paste, overlays, tooltips → M5
- **Did:**
  - **LOD preview-while-editing:** `quality` ('preview'|'full') flows through
    `evaluateGraph` → `EvalContext` → worker → `EvalService`, and is part of the cache
    hash. Primitives mark segment params `lod` (×0.4 in preview); Lathe/Extrude cut
    segments/bevel/curve detail in preview. The hook (`useEvaluatedGeometry`) requests
    preview during rapid edits and a trailing **full** pass ~220ms after they settle.
    Export/codegen are always full, so generated output is unaffected (parity intact).
  - **Copy/paste/duplicate:** store `duplicateNode`/`copyNode`/`pasteNode` + clipboard;
    Ctrl/Cmd+D, +C/+V (guarded against text inputs); Inspector Duplicate button.
  - **Viewport overlays:** wireframe + grid toggles, live tri/vert stats.
  - **Tooltips:** `NodeDef.description` on every node → palette tooltip + inspector
    subtitle.
  - Tests: +3 clipboard, +2 LOD. 65/65 green.
- **Verified:** typecheck, 65 tests, lint, build, dev-boot clean.
- **Decisions/notes:** LOD reduction factor 0.4 (min clamped); only segment-like params
  reduce, so shape/topology stays recognizable in preview. Transform gizmos deferred —
  awkward in a procedural pipeline (which node would they edit?); revisit if users want
  direct manipulation that writes back to a Transform node.
- **Next:** Phase 5 extras (Expression/Random nodes, R3F target).

### 2026-06-24 — Phase 6 batch 1: robustness, autosave, glTF, search
- **Did:**
  - **Error robustness:** `useEvaluatedGeometry` keeps the last good geometry/material
    when an eval returns errors (viewport never blanks); failing nodes are highlighted red
    in the graph (errors → `errorNodeIds` → node `data.error`); messages in the overlay.
  - **Autosave:** `state/persistence.ts` — debounced localStorage save on graph change,
    restore on startup (in `main.tsx`), corrupt-data safe; **New** toolbar button +
    `newGraph` store action. Test with a localStorage mock (3 cases).
  - **glTF/GLB export (Target C):** `export/gltf.ts` (GLTFExporter → Blob) + Export panel
    redesigned with **Code / glTF tabs**; .glb (binary) + .gltf (JSON) downloads.
  - **Palette search:** filter box over node label/category.
- **Verified:** typecheck, 60 tests, lint, build, dev-server boot.
- **Decisions/notes:** glTF export is browser-only (GLTFExporter needs DOM) — not unit
  tested; the geometry/material it serializes is already parity-covered. Last-good-geometry
  only kicks in when there ARE errors (a legitimately empty graph still clears).
- **Next:** Phase 6 batch 2 (perf/LOD, viewport overlays+gizmos, copy/paste, tooltips),
  then Phase 5 extras.

### 2026-06-24 — Phase 5 core: parametric system → M4 reached
- **Did:** Exposed parameters end-to-end (build → live tweak → parameterized export).
  - Store: `exposeSocket`/`unexposeParam`/`setParamValue`/`renameParam`; unique
    identifier naming; params dropped when their node is deleted; setParamValue keeps the
    bound node literal in sync (so unexposing preserves the value); history-aware.
  - Engine: `resolveInputs` applies param overrides (edge > param > literal > default);
    cache hash includes per-node param values (`paramSig`) so dragging a param re-evals.
  - Codegen: `exprFor` emits `params.<name>` for bound sockets; function signature is
    `createModel(params = { … })` with rendered defaults; `paramDefaults` exposed for the
    harness; `runGenerated(result, overrides)` injects merged params.
  - UI: shared `ValueControl` (slider/number/color/bool/enum/text) used by both Inspector
    and the new **Params panel**; Inspector gained an **expose** toggle per input (shows
    "controlled by param" when exposed); right column split Inspector / Params.
  - Tests: param parity (defaults match eval) + **override** (run with `{width:5}` matches
    eval-with-5 and differs from default). 57/57 green.
- **Verified:** typecheck, 57 tests, lint, build, dev-server boot.
- **Decisions/notes:** A param's value and its exported default are **unified** for v1
  (editing the slider changes the baked default) — simplest mental model; splitting
  preview-value vs default is a future refinement. Only connectable sockets are
  non-exposable; all scalar inputs can be promoted. Expression/Random nodes + R3F target
  remain as Phase-5 extras.
- **Next:** Phase-5 extras (optional) or jump to Phase 6 commercial polish.

### 2026-06-24 — M2 demo: example library + blank-project export proof
- **Did:**
  - Authored 3 bundled example graphs in `src/examples/index.ts`: **Asteroid**
    (sphere→displace→material), **Beveled Gear** (star→extrude+bevel→transform→material),
    **Cored Cube** (box,sphere→boolean subtract→material). Added an **Examples** menu to
    the toolbar to load them.
  - `examples.test.ts`: each example evaluates to non-trivial geometry AND its generated
    code runs (in-process) matching the evaluation. 55/55 tests green.
  - **Blank-project proof:** generated the exported code to `examples/generated/*.mjs`
    and ran them under **plain Node** with only `three`(+`three-bvh-csg`) from
    node_modules — no app/bundler. All execute (Asteroid 2976 tris, Gear 284,
    Cored Cube 1539). `examples/README.md` documents it; `node examples/generated/_verify.mjs`.
  - Polished material codegen (removed an ugly double-ternary → `new (… ? A : B)({…})`).
- **Verified:** typecheck, 55 tests, lint, build clean; node execution of generated code.
- **Decisions/notes:** Examples deliberately avoid array/mirror so the generated code only
  needs `three`/`three-bvh-csg` (three's `examples/jsm` deep import isn't always Node-ESM
  resolvable). Playwright smoke test still deferred (unit + node-exec coverage is strong).
  This nails M2 + makes M3's promise tangible: build → export → runs identically.
- **Next:** Phase 5 — parametric system (exposed params, live sliders, parameterized
  `createModel(params)`), → M4.

### 2026-06-23 — Phase 4 MVP: the code generator → M3 reached
- **Did:** Built the product's crown jewel — graph → clean vanilla three.js code.
  - Shared `graph/topology.ts` (topoSort), refactored `evaluate.ts` to use it.
  - `codegen/`: `literal.ts` (render literals), `imports.ts` (specifier→import +
    parity-injection info), `helpers.ts` (self-contained noise helper),
    `generate.ts` (`generateModule` → `{code, functionBody, helperSource, modules}`),
    `runGenerated.ts` (executes emitted code in-process for tests).
  - Output assembly: `export function createModel()` builds each node's CodeFragment in
    topo order, dedupes imports, injects helpers, returns `new THREE.Mesh(geom, material
    ?? default)`.
  - **Parity harness** (`codegen.parity.test.ts`): runs generated code and asserts
    positions === live eval across all node types; `codegen.helpers.test.ts` guards noise
    drift. 49/49 tests green.
  - Export UI (`ExportPanel`) + toolbar "Export Code": preview / copy / download .ts.
- **BUG FOUND BY PARITY (real, not codegen):** `toBufferGeometry` wrapped GeometryData
  typed arrays **by reference**, so in-place ops (applyMatrix4 in transform/mirror,
  translate in array) mutated cached upstream geometry — corrupting the eval cache and
  breaking mirror/array. Fixed by copying buffers in `toBufferGeometry` (it now owns its
  data). Exactly the class of bug the parity harness exists to catch.
- **Decisions (ADR-007):** generated code uses **namespace three import**
  (`import * as THREE`) for simplicity/readability; modules mapped via a small registry;
  node helpers injected on demand. Prettier formatting **deferred** (output already clean;
  prettier/standalone bundling is a later polish). Displace codegen made self-contained
  via an injected `makeNoise3` (drift-guarded).
- **Verified:** typecheck, 49 tests, lint, build clean.
- **Next:** the M2 demo (build+export a real model, examples, Playwright), then Phase 5
  (parametric system → M4).

### 2026-06-23 — Phase 3 cont.: curves + generators (extrude, lathe)
- **Did:**
  - New **`shape` socket type** + `ShapeData` (serializable 2D profile) in
    `geometry/ShapeData.ts` with `polygonPoints`/`starPoints`/`toThreeShape`/
    `toVector2Array`. Added to SocketType/SocketValue/`isConnectableType`/`LiteralValue`;
    `shape()` helper.
  - Profile nodes: **Polygon** (n-gon), **Star** (inner/outer radius) → output `shape`.
  - Generators: **Extrude** (THREE.ExtrudeGeometry, depth/steps/bevel, centered on Z),
    **Lathe** (THREE.LatheGeometry, segments/sweep°).
  - Codegen convention: profile nodes emit a `Vector2[]`; Extrude wraps it in
    `new THREE.Shape(...)`, Lathe passes it directly — keeps the two consistent.
  - UI: shape handles render green; no new inspector control needed.
  - Tests (`generators.test.ts`): polygon/star→extrude (incl. Z-depth check),
    polygon→lathe, and shape↦geometry type-mismatch rejection. 38/38 total green.
- **Verified:** typecheck, 38 tests, lint, build clean.
- **Decisions/notes:** Profiles are **parametric only** for now (Polygon/Star); freehand
  2D curve editing is a future feature. Lathe treats the profile as a silhouette
  (x=radius); polygons revolve fine though one-sided custom profiles will be ideal once a
  curve editor exists. This effectively completes the M2 toolkit — next is an M2 demo +
  Playwright, then Phase 4 (code generator).
- **Next:** M2 review/demo, then Phase 4 code generator + parity harness.

### 2026-06-23 — Phase 3 cont.: Material node (new socket type)
- **Did:** Implemented materials as planned, with a refined design (ADR-006):
  - `material/MaterialData.ts`: `MaterialSpec` (plain PBR description w/ `kind`
    discriminator), `defaultMaterialSpec`, `isMaterialSpec`, `toThreeMaterial`.
  - Graph types: added `'material'` socket type + `MaterialSpec` to `SocketValue`;
    `isConnectableType()`; introduced `LiteralValue` alias for node-stored values.
  - **Material** node (`material.standard`): type/color/roughness/metalness/opacity/
    flatShading/wireframe → outputs a `material`. `mat()` helper added.
  - Output node gained a **Material input**; `EvalResult` now carries `material`; engine
    reads both Output sockets. Threaded material through hook → App → Viewport
    (`toThreeMaterial`, DoubleSide, default when unconnected).
  - UI: handles now render for **any connectable socket type** (geometry + material,
    color-coded); Inspector got a **color** control.
  - Tests (`material.test.ts`): material flows to output when connected (color/metalness/
    type), null when not. 34/34 total green.
- **Decision (ADR-006):** material is a **separate socket** combined at Output, not a
  geometry+material bundle — simpler, keeps modifiers material-agnostic, one value type
  per socket.
- **Verified:** typecheck, 34 tests, lint, build clean.
- **Next:** curves/extrude/lathe (biggest remaining gap), then circle/subdivide, then M2.

### 2026-06-23 — Phase 3 cont.: deformers (displace, twist, taper)
- **Did:**
  - `geometry/noise.ts`: seeded improved-Perlin 3D noise (deterministic per seed).
  - `geometry/ops.ts`: `deformGeometry(data, fn)` — per-vertex map that never mutates the
    input (copies buffers) and recomputes normals; `axisIndex` helper.
  - Nodes: **Displace** (noise along normals, strength/frequency/seed), **Twist**
    (rotate around axis by °/unit of position), **Taper** (scale perpendicular axes from
    1→endScale along an axis).
  - Tests (`deformers.test.ts`): noise determinism; displace preserves vertex count,
    moves verts, deterministic, zero-strength no-op; twist changes positions; taper
    collapses the cross-section. 32/32 total green.
- **Verified:** typecheck, 32 tests, lint, build clean.
- **Decisions/notes:** **Bend deferred** — its deformer math is error-prone and I chose
  correct/tested over rushed. Deformer `codegen` is **provisional** (emits per-vertex
  loops; displace references a `noise3()` helper the Phase-4 generator will inject) —
  fine since codegen isn't executed until Phase 4. Next big call is the Material node,
  which forces Output to carry geometry+material (see Next Up #1).
- **Next:** Material node + the geometry→{geometry,material} output change.

### 2026-06-23 — Fix: node deletion didn't work
- **Reported:** user couldn't delete a node.
- **Cause:** `rfNodes`/`rfEdges` never set `selected`, so React Flow's keyboard delete
  (which acts on `selected` elements) had nothing to remove.
- **Fix:** reflect `selectedNodeId` into `rfNodes[].selected`; added `onNodesDelete`,
  `deleteKeyCode={['Backspace','Delete']}`, and a visible **Delete** button in the
  Inspector for discoverability. typecheck/lint/27 tests green.
- **To delete:** click a node then press Delete/Backspace, or use the Inspector's Delete
  button. (Undo restores it.)

### 2026-06-23 — Phase 3 cont.: array, mirror, booleans (CSG)
- **Did:**
  - Geometry ops: `mergeGeometriesData` (BufferGeometryUtils) + `mirrorGeometry`
    (negative-scale with winding reversal) in `geometry/ops.ts`.
  - CSG wrapper `geometry/csg.ts` (three-bvh-csg `Evaluator`/`Brush`, groups off,
    degenerate-operand handling).
  - Nodes: **Array** (linear + radial, merges copies), **Mirror** (axis + keepOriginal),
    **Boolean** (union/subtract/intersect) — the first node with **two geometry input
    sockets**.
  - UI: added the `select` control to the Inspector (used by mode/axis/operation).
  - Tests (`modifiers.test.ts`): array tri-count & bbox, mirror symmetry, boolean
    subtract/union + operand passthrough on disconnect. 27/27 total green.
- **Verified:** typecheck, 27 tests (incl. real CSG in the test env), lint, build clean.
- **Decisions/notes:** **Multi-geometry-input sockets work** with no engine changes —
  `resolveInputs` already keys by socket id, and the editor renders a handle per
  geometry socket. CSG runs fine in the worker/Node env. Array is one node with a `mode`
  select (grid still TODO). Mirror's *codegen* leaves a TODO for emitting the index-flip
  (Phase 4). Identified upcoming need: Output must carry **material + geometry** — will
  revisit the single-output convention when the Material node lands.
- **Next:** deformers (displace/twist/bend/taper), then subdivide/smooth, then materials.

### 2026-06-23 — Phase 3 start: primitives + first modifier
- **Did:** User confirmed M1 works in-browser. Then began the modeling toolkit:
  - Node-authoring helpers (`nodes/helpers.ts`): `num/bool/str/vec3/geom`, `codeArgs`.
  - Primitive **factory** (`primitives/factory.ts`): one config drives both `evaluate`
    and `codegen`, keeping them in lock-step by construction. Migrated box to it and
    added sphere, cylinder, cone, torus, plane (`primitives/primitives.ts`); deleted the
    old hand-written `box.ts`.
  - Geometry ops (`geometry/ops.ts`): `transformGeometry(matrix)` + `composeMatrix`;
    `emptyGeometry()` added to `GeometryData`.
  - **Transform** modifier (`modifiers/transform.ts`): first geometry-in→geometry-out
    node — proves the engine chains modifiers correctly (the key de-risking step).
  - Tests (`nodes.test.ts`): all 6 primitives produce geometry, sphere radius drives
    bbox, transform translate/scale through a 3-node chain, empty-on-disconnect,
    registry count. 21/21 total green.
- **Verified:** typecheck, 21 tests, lint, build all clean.
- **Decisions/notes:** Transform uses **per-axis scalar inputs** (tx/ty/tz, rx/ry/rz°,
  sx/sy/sz) so it works with today's inspector (vector UI still deferred). Engine's
  single-output convention holds fine for modifiers. `codegen` written for every node
  but not yet executed — Phase 4 builds the generator + parity tests.
- **Next:** Array/mirror (needs `mergeGeometries`), then booleans (needs 2 geometry input
  sockets — verify engine/UI), then deformers.

### 2026-06-23 — Bugfix: nodes could not be added (DataCloneError)
- **Reported:** console errors + unable to add Box/Output nodes.
- **Root cause:** `pushHistory`/`undo`/`redo` ran `structuredClone(s.graph)`, but inside
  the Immer middleware producer `s.graph` is a **draft Proxy** — not cloneable → a
  `DataCloneError` threw on every mutation, so `addNode` always failed.
- **Fix:** snapshot via immer `current(s.graph)` before `structuredClone` (new `snapshot()`
  helper in the store). Plus hardening done in the same pass: StrictMode-safe worker
  lifecycle in `useEvaluatedGeometry`, app-wide `ErrorBoundary` (no more white-screens),
  HMR-safe `registerNode` (overwrite vs throw), guarded WebGL init in `Viewport`, inline
  favicon (404).
- **Tests:** +4 store tests (add node regression, output wiring, undo/redo, snapshot
  independence). 15/15 green; typecheck/lint/build clean. Commit `ca3bf0e`.
- **Lesson (for plan):** with Immer middleware, never clone `s.*` drafts directly — use
  `current()` first. Watch for this in future store work.
- **Next:** user to confirm end-to-end in browser, then resume Phase 3.

### 2026-06-23 — Phase 2 core engine loop → M1 reached
- **Did:**
  - **Worker eval:** `EvalCache` (content-hash cache, FNV-1a hashing in `engine/hash.ts`,
    per-node hash folds in upstream node hashes + literals + seed; `sweep()` GCs stale
    entries). `evalWorker.ts` (Comlink) holds the persistent cache; `EvalService`
    (main thread) wraps it with **request coalescing** (drops superseded graphs);
    `useEvaluatedGeometry` hook feeds the viewport asynchronously.
  - **Undo/redo:** snapshot-based history in the store (graphs are tiny, no geometry),
    coalescing consecutive slider/move edits into one step; Ctrl/Cmd+Z / Shift+Z.
  - **Save/load:** `serialize.ts` (pretty JSON, version check, unknown-node rejection,
    download helper) + toolbar Save/Load buttons + notice bar.
  - **Validation:** `validate.ts` (type match, self-connect + cycle prevention via
    reachability); `addEdge` rejects invalid edges and shows a UI notice.
  - **Tests:** +8 (cache reuse/recompute/sweep, validation incl. cycle, serialize
    round-trip + unknown-node reject). 11/11 green.
- **Verified:** typecheck, 11 tests, lint, build (worker emits its own `evalWorker-*.js`
  chunk), dev server + worker module both serve HTTP 200.
- **Decisions/notes:** Chose **snapshot history** over Immer patches — simpler/robust for
  small graph state. Worker returns **structured-cloned** GeometryData (not transferred)
  so the cache can hold master copies safely; true transferables deferred to the Phase 6
  perf pass (logged in Deferred/tech-debt). Single-output-socket convention still holds;
  must validate it against geometry-in modifier nodes at the start of Phase 3.
- **Next:** Phase 3 — modeling toolkit (primitives, transform, array, booleans,
  deformers) → M2.

### 2026-06-23 — Phase 1 scaffold → M0 reached
- **Did:** Stood up the full app skeleton and hit M0.
  - Vite + React 18 + TS (strict, `noUncheckedIndexedAccess`) + ESLint/Prettier/Vitest.
  - Core types: `GeometryData` (+ `toBufferGeometry`/`fromBufferGeometry`/transferables),
    `Graph`/`GraphNode`/`Edge`/`ExposedParam`, `NodeDef` (dual `evaluate`/`codegen`),
    node registry, seeded RNG (mulberry32).
  - Engine: synchronous main-thread `evaluateGraph` (Kahn topo-sort, edge resolution,
    cycle detection). Worker + caching deferred to Phase 2 by design.
  - Nodes: `primitive.box` (full evaluate + codegen) and `output.mesh` (passthrough).
  - State: Zustand + Immer store (add/remove/move nodes, edges single-conn per socket,
    set values, select, load).
  - UI: three.js `Viewport` (orbit/grid/axes/lighting/resize, imperative scene), React
    Flow `GraphEditor` (generic socket-driven node view), `Inspector` (live sliders),
    node palette, app shell + dark theme.
  - Tests: 3 box eval tests (geometry produced, literals honored, determinism) — green.
- **Verified:** `typecheck`, `test` (3/3), `build`, `lint` all pass; dev server boots and
  serves transformed modules (HTTP 200).
- **Decisions/notes:** Layout is palette | (graph stacked over viewport) | inspector
  rather than 4 separate panels — better for a stacked center column; params panel lands
  in Phase 5. Single-output-socket convention in the engine for now (revisit for
  multi-output nodes). three-mesh-bvh bumped to 0.8.x for three 0.169 compat.
- **Next:** Phase 2 — worker-based eval, caching, undo/redo, save/load (→ M1).

### 2026-06-23 — Project kickoff & planning
- **Did:** Created the three source-of-truth docs: `PROMPT.md` (refined vision &
  end-game), `ARCHITECTURE.md` (stack, data model, dual evaluate/codegen contract,
  evaluation engine, codegen strategy, ADRs 001–005), and this plan.
- **Decisions:** Node-graph paradigm; TS/Vite/React/Zustand/React Flow/three.js stack;
  worker-based evaluation; `GeometryData` flat-buffer IR; dual evaluate/codegen node
  contract; three-bvh-csg for booleans. (See ADRs in `ARCHITECTURE.md`.)
- **Next:** Begin Phase 1 — scaffold the project and reach M0 (box node → viewport).
