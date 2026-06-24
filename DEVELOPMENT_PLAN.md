# Development Plan — Procedural 3D Modeler for three.js

> **This is the single source of truth for the project.**
> Read it at the start of every session. **Update it at the end of every session**
> (status checkboxes, the Session Log, and Next Up). Companion docs:
> `PROMPT.md` (vision), `ARCHITECTURE.md` (how it's built).

- **Status:** Phases 0–6 done + procedural animation. Phase 7 (launch prep) in progress.
- **Last updated:** 2026-06-24
- **Current phase:** Phase 7 — launch prep (done: examples, onboarding tour, PWA/offline).

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
- [x] **Expression** node (formula of a, b, Math → number) + **seeded Random** node
      (deterministic value in [min,max]). Enabled by making **`number` sockets
      connectable** so value nodes drive scalar inputs; added `CodegenContext.rawInput`
      (emits the Expression formula raw, not quoted) and `randomUnit(seed)` shared by
      eval + codegen. Inspector shows "driven by a connected node" for wired inputs.
      _(Plain text formula field for now; Monaco is optional future polish.)_
- [x] Export target D (graph JSON) — save/load. [x] **Target B (R3F)** — `generateModule`
      gains `target: 'vanilla' | 'r3f'`; R3F emits a `<Model props>` component with a
      `useMemo` building `{geometry, material}` and a `<mesh>`, param props with defaults
      and a value-keyed deps array. Shares the exact build statements with vanilla
      (`functionBody` identical), so geometry is parity-correct by construction.
- **Exit criteria (M4):** ✅ exposed params drive the viewport live and the exported
  `createModel(params)` is runtime-parameterized. **Phase 5 fully complete** (params, R3F
  target, Expression + Random nodes).

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
- [x] Viewport tools: **wireframe / grid toggles + stats** overlay; **lighting control**
      (`viewport/lighting.ts` presets + `LightsControl` popover: ambient/key sliders +
      background color, persisted). [ ] transform gizmos.
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
- [x] Onboarding flow + interactive tutorial — first-run **WelcomeModal** + 5-step coachmark
      **Tour** (spotlight + popover over palette/graph/properties/viewport/export via stable
      `data-tour` anchors). "Seen" flag persisted (`p3m.onboarded.v1`); re-launchable from the
      header **?** button. Esc/←/→ supported; missing targets fall back to a centered card.
- [~] Example/template library — 9 built-in starter graphs (Examples menu); any can be
      Saved to JSON. (Faceted Gem, Hollow Pipe, Capsule, Twisted Column, Spinning Propeller +
      the originals.) TODO: thumbnails in the menu, importable community templates.
- [x] Versioned graph format + migration strategy — `src/graph/migrate.ts` runs an ordered
      migration chain from a file's `version` up to current `GRAPH_VERSION` (now `0.2.0`).
      Wired into `deserializeGraph` (so Load + autosave restore both upgrade); newer-than-current
      files load as-is with a warning; versionless/unrecognized upgrade from base. Pure +
      injectable for tests (8 migration tests).
- [ ] Telemetry (opt-in), error reporting
- [~] Packaging/deploy — **PWA/offline done** (vite-plugin-pwa: generated SW precaches the
      app + eval worker for full offline use; installable manifest + icons; "new version →
      Reload" prompt; "ready offline" notice). **Deploy/CI:** GitHub Pages workflow added
      (`.github/workflows/deploy.yml`: typecheck+lint+test+build, env-driven base). Pending:
      enable Pages in repo settings (one-time); billing/licensing hooks (needs product decision).
- [ ] Landing page + marketing assets
- **Exit criteria (M6):** publicly usable, monetizable product.

---

## Procedural animation (delivered ahead of Phase 7)  `[~]`
- [x] Time clock through the engine (`EvalContext.time`, `NodeDef.timeDependent`,
      time-aware cache hashing so only the animated subgraph recomputes per frame).
- [x] **Time** node (`value.time`, speed) feeding numeric inputs (via Expression etc.).
- [x] Viewport **Play/Pause** (rAF loop advancing the clock, preview-quality per frame;
      shown only for animated graphs).
- [x] Codegen: vanilla `createModel(params, time)`; **R3F** animated variant (`useFrame`
      → time state → `useMemo` keyed on time). `runGenerated(result, overrides, time)`.
- [x] Animated example ("Pulsing Asteroid"). Parity tested at non-zero time.
- [ ] Future: timeline scrubber, loop range, more drivers (sin/ease presets), bake to glTF
      animation, morph targets.

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
1. **Phase 7 — launch prep:** onboarding/tutorial, more example templates, versioned-graph
   migration, telemetry (opt-in), deploy/PWA, landing page.
2. Animation extras: timeline scrubber + loop range; bake-to-glTF animation.
3. Phase 6 remainder (optional polish): transform gizmos, node groups/comments, recent
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

### 2026-06-24 — Performance: code-splitting
- Lazy-load on-demand UI via `React.lazy` + `Suspense`: **ExportPanel** (pulls in the
  glTF/STL/OBJ exporters, ~49 kB), **AboutModal**, onboarding **WelcomeModal/Tour**.
- `build.rollupOptions.output.manualChunks` splits **three** (~536 kB) and **@xyflow/react**
  (~326 kB) into their own vendor chunks (parallel download + cached across deploys).
- Net: the single ~1,142 kB app bundle became app `index` **~227 kB** + cached vendor chunks;
  exporters/modals load only when opened. (CSG already lived in the eval-worker chunk.)

### 2026-06-24 — Projects: local multi-project manager
- New `src/state/projects.ts` (localStorage `p3m.projects.v1`): `getProjects` (newest-first),
  `saveProject` (upsert; returns false on quota), `deleteProject`, `renameProject`. Each
  **Project** = {id, name, graph, thumbnail (small JPEG dataURL), updatedAt}. +2 tests (111 total).
- `ProjectsModal` (lazy): name field + **Save current**, and a card grid (thumbnail/name/date)
  with Open, Overwrite-with-current, Duplicate, Rename, Delete. Opened from a new toolbar
  **Projects** button. Thumbnails come from the viewport via `captureThumbnail()` (downscaled to
  240px JPEG). Distinct from the rolling autosave and Save/Load-to-file. Added `folder`/`edit` icons.

### 2026-06-24 — Tooltip thumbnails for the new nodes
- Added dedicated `NodeThumbnail` line-art for the new nodes (were hitting the generic fallback):
  capsule (pill), circle (disc), ring (annulus, evenodd hole), torus knot (interlocked loops),
  tetra/octa/dodeca/icosahedron (faceted wireframes), and Bend (a bar curving into an arc).
  Renamed the per-type map `PRIMITIVES` → `BY_TYPE` (now also holds the bend deformer).
- All checks clean.

### 2026-06-24 — More geometry: 8 primitives + Bend deformer
- New primitives via the existing factory (all inherit built-in transform): **Capsule, Circle,
  Ring, Torus Knot, Tetrahedron, Octahedron, Dodecahedron, Icosahedron** (6 → **14** primitives).
  Added a `detail()` param helper (LOD-reduced like segment counts) for the polyhedra.
- New **Bend** deformer: like Twist but rotates about a perpendicular axis (cyclic x→y→z→x), so
  geometry curls into an arc; eval via `deformGeometry`, codegen mirrors the loop (parity-tested).
- Registry now **31** nodes. Parity tests cover every new primitive + bend; node-count test updated.
- All checks clean (109 tests). Deferred (need more than the numeric factory): Tube (path),
  3D Text (font asset), Bezier/spline curve, Subdivide (no core modifier).

### 2026-06-24 — Viewport toolbar: icon-only buttons
- Wireframe / Grid / Lights / PNG are now **icon-only** (with `title` + `aria-label` tooltips):
  added `wireframe`, `grid`, `sun` icons; PNG reuses `camera`. New `.viewport__iconbtn` style
  (square, stroke icons, accent active state). LightsControl button became the sun icon.
- All checks clean (109 tests).

### 2026-06-24 — Wider export: STL + OBJ (3D printing / DCC)
- New `src/export/mesh.ts` (`exportSTL` binary/ASCII, `exportOBJ`, `downloadBlob`) via three's
  STL/OBJ exporters. Added an **STL / OBJ** tab to the Export modal: STL binary, STL ASCII, OBJ
  downloads with status + empty-state guard. Geometry-only formats (noted in the UI; use glTF for
  materials). +3 tests (binary STL exact byte size, ASCII facets, OBJ verts/faces) → 109 total.
- Note: binary STL `DataView` cast to `BlobPart` (TS narrows its buffer to ArrayBufferLike).
- This opens the 3D-printing / DCC interchange use case for the standalone app.

### 2026-06-24 — Show app version in About modal
- Bumped `package.json` version 0.0.0 → **1.0.0** (live, feature-complete) and inject it via Vite
  `define: { __APP_VERSION__ }` (read from package.json; declared in `vite-env.d.ts`). About modal
  shows a `v1.0.0` chip beside the "Early Access" badge in the hero. All checks clean.

### 2026-06-24 — Editor & viewport UX (batch 4): transform gizmo
- Selecting a node that has transform sockets (any primitive or the Transform modifier) shows a
  three `TransformControls` gizmo in the viewport. It drives an **invisible proxy** Object3D;
  on `objectChange` the proxy's decomposed TRS (Euler 'XYZ' → degrees) is written back to the
  node's `tx/ty/tz · rx/ry/rz · sx/sy/sz` via `setNodeValues(..., coalesceKey)` so a whole drag
  is **one undo step**. `dragging-changed` disables OrbitControls while dragging.
- Math note: our `composeMatrix` is `T*R*S` with Euler 'XYZ'; the proxy uses the same order, and
  world-space gizmo rotation premultiplies the quaternion exactly as our matrix does — so reading
  the proxy back round-trips correctly (verified for centered primitives and the Transform node).
- Modes Move/Rotate/Scale via toolbar buttons + **W/E/R** keys (only while the gizmo is shown).
  Gizmo syncs from store values (so inspector edits move it too) but **skips sync while dragging**
  to avoid fighting the re-evaluated values. Screenshot hides the gizmo helper.
- Editor/viewport UX bundle (minimap, right-click add, screenshot, minimap toggle, view gizmo,
  notes/frames, transform gizmo) is now **complete**. 106 tests; all checks clean.

### 2026-06-24 — Editor & viewport UX (batch 3): node comments / frames
- Added decorative **notes/frames**: a new optional `Graph.notes: GraphNote[]` (id/text/position/
  width/height/color) that the engine, codegen, topo and validate fully ignore. Store actions
  `addNote`/`updateNote`/`removeNote` (history-coalesced text/drag/resize). Defaulted to `[]` on
  load (serialize) and in `createEmptyGraph`; round-trip + legacy-absent test added.
- `NoteNode` (React Flow custom node): resizable (`NodeResizer`), editable title, cycle-color
  button, delete; **dragged by its title bar** and rendered **behind** real nodes (zIndex/order)
  so it frames them without intercepting their interactions. Added via the right-click menu
  (“＋ Note / frame”) at the cursor.
- Change routing in `onNodesChange` distinguishes note ids (position→updateNote, dimensions→size,
  remove→removeNote) from real nodes. Selecting a note doesn't break the Inspector (it just shows
  the empty state). Kept the field **optional** so existing graph literals/tests need no changes.
- 106 tests; all checks clean. **Next:** transform gizmo (bind to a selected primitive's
  built-in transform sockets).

### 2026-06-24 — Editor & viewport UX (batch 2): minimap toggle + view gizmo
- **Minimap toggle:** a `ControlButton` (map icon) next to the zoom controls shows/hides the
  minimap; state persisted (`p3m.minimap.v1`), active state styled in accent. Scoped CSS so the
  stroke-based icon isn't force-filled like the default control icons.
- **View-navigation gizmo:** integrated three's `ViewHelper` (corner axis cube) — click an axis
  to snap the camera to top/bottom/front/back/left/right (CAD-style). Required `renderer.autoClear
  = false` + manual `clear()`; animate loop now updates the helper (clock delta) and calls
  `viewHelper.render()`; `pointerup` → `handleClick`. `capturePNG()` clears then renders scene
  only, so the gizmo never appears in screenshots. Disposed on unmount.
- All checks clean (105 tests). (This was a prerequisite the user asked for before node
  comments/frames + the transform gizmo.)

### 2026-06-24 — Editor & viewport UX (batch 1): minimap, right-click add, screenshot
- **MiniMap** in the graph editor (category-colored nodes, pannable/zoomable, themed).
- **Right-click the canvas → add-node menu** at the cursor (`GraphContextMenu`): filterable,
  Enter adds the first match, closes on pick/Esc/outside-click. Node drops at the click position.
- **Viewport screenshot:** `Viewport` is now a `forwardRef` exposing `capturePNG()` (renders a
  frame synchronously, returns a PNG data URL); a **PNG** button in the viewport toolbar downloads
  `model.png`. Added `camera` icon.
- Deferred (own session, noted to user): **node comments/frames** (needs a graph data-model
  addition, e.g. `graph.notes[]`) and a **transform gizmo** (awkward today — we render one merged
  output mesh, not per-node objects; the clean version maps the gizmo to a selected primitive's
  built-in transform sockets).
- All checks clean (105 tests). Project re-scoped: **free standalone app, no telemetry/billing**
  (see memory) — Phase 7 business items dropped; future work = features/UX/perf.

### 2026-06-24 — Edge deletion + GitHub Pages deploy/CI
- **Delete connections.** New `DeletableEdge` (custom React Flow edge) shows a “×” button at
  the edge midpoint on hover/selection (wide invisible hit-path for easy hovering); click removes
  the edge. Also added `onEdgesChange` so Backspace/Delete removes a selected edge (replaces the
  old `onEdgesDelete`). Fixes: previously a mis-wired link could only be cleared by deleting a node.
- **GitHub Pages.** Vite `base` is now env-driven (`DEPLOY_BASE`, default `/`); PWA manifest
  `scope`/`start_url`/`id` follow it so the app works under `/<repo>/`. Added
  `.github/workflows/deploy.yml` (typecheck → lint → test → build with
  `DEPLOY_BASE=/${{ repo name }}/` → upload-pages-artifact → deploy-pages) and `public/.nojekyll`.
  Verified a subpath build rewrites all asset/manifest URLs correctly. User must enable Pages
  (Settings → Pages → Source: GitHub Actions) once.
- All checks clean (105 tests).

### 2026-06-24 — Phase 7: versioned graph format + migration
- New `src/graph/migrate.ts`: an ordered, pure migration chain. `migrateGraph(raw, migrations?,
  latest?)` detects a document's `version` and applies each migration from there up to
  `GRAPH_VERSION`. Bumped `GRAPH_VERSION` 0.1.0 → **0.2.0** with a first migration that
  normalizes to the per-primitive-transform era (ensures `params`/`outputNodeId` and per-node
  `values`/`position`). Behaviors: already-current → untouched; versionless/unrecognized →
  upgrade from base with a warning; newer-than-current → loaded as-is with a "created by a newer
  version" warning (best-effort forward compat).
- Wired into `deserializeGraph`, so both **Load** and the autosave **restore** path upgrade old
  files transparently; structural guards + unknown-node-type rejection still run post-migration.
- Migrations + target version are injectable, so chaining/start-index logic is unit-tested
  without inventing fake production migrations. +8 tests (105 total).
- All checks clean. **Next:** deploy/host + CI, or product-decision items (telemetry, billing).

### 2026-06-24 — Phase 7: PWA / offline + installable
- Added `vite-plugin-pwa` (generateSW). The built service worker precaches the app shell, main
  bundle and eval worker (16 entries, ~1.35 MiB) for **full offline use**; bumped
  `maximumFileSizeToCacheInBytes` to 4 MiB to cover the large bundles. Plugin `disable`d under
  VITEST so unit tests are unaffected.
- Installable: `manifest.webmanifest` (name/short_name/description/theme+bg `#11141b`,
  standalone, categories, 192/512/maskable icons) + head meta (theme-color, apple-touch,
  apple-mobile-web-app-*). Favicon switched to a vector `favicon.svg`.
- **Dependency-free icon generation:** `scripts/gen-icons.mjs` (`npm run icons`) draws the brand
  isometric cube and encodes real PNGs via Node `zlib` (custom CRC/PNG chunks + scanline polygon
  fill) — no image libs. Emits 192/512/maskable-512/apple-180 + favicon.svg into `public/`.
- Update UX: `src/pwa.ts` registers via `virtual:pwa-register` (registerType 'prompt') and shows a
  dismissible "new version → Reload" toast (no silent reload → no lost work; graph autosaves
  anyway) plus a transient "ready to work offline" notice. Added `vite-plugin-pwa/client` types.
- 97/97 tests; typecheck/lint/build clean; verified `dist/` emits sw.js, workbox, manifest, icons.
  **Next:** deploy/host + CI; then graph versioning/migration, or the product-decision items
  (telemetry, billing, landing page).

### 2026-06-24 — Phase 7: onboarding flow + interactive tutorial
- **WelcomeModal** on first run (offers the tour or skip); seen-flag persisted as
  `p3m.onboarded.v1`. **Tour** (`src/ui/Onboarding.tsx`) is a portal overlay that spotlights one
  area at a time (CSS box-shadow cutout) with a stepped popover; targets are stable `data-tour`
  anchors on palette/graph/inspector/viewport/export (`src/ui/tour.ts` holds the script + helpers).
  Keyboard: Esc closes, ←/→ navigate. A missing/collapsed target falls back to a centered card.
- Re-launchable anytime from a new header **?** button (added a `help` icon).
- Gotcha: `Onboarding.tsx` + `onboarding.ts` collided on case-insensitive macOS FS (TS1261/1149);
  renamed the data module to `tour.ts`.
- 97/97 tests; typecheck/lint/build clean. **Next:** PWA / offline + deploy.

### 2026-06-24 — Phase 7 (start): expanded example/template library
- Added 5 new built-in examples (now 9 total), each verified end-to-end by `examples.test.ts`
  (non-trivial geometry + codegen↔eval parity): **Faceted Gem** (two 8/16-facet cones unioned),
  **Hollow Pipe** (cylinder − cylinder), **Capsule** (cylinder + 2 spheres unioned, placed via
  built-in transforms), **Twisted Column** (segmented box + Twist), **Spinning Propeller**
  (tapered blade → radial Array → union with hub → Time→Expression→Transform spin; animated).
- They double as a showcase of the new per-primitive transforms, booleans, arrays, deformers,
  value nodes and animation.
- Note: the Gem at 8 facets is geometrically a 16-tri solid (correct but below the test's
  >50-tri "non-trivial" bar) — bumped to 16 radial × 2–3 height segments to keep it faceted
  yet substantial.
- 97/97 tests; typecheck/lint/build clean. **Next:** onboarding/tutorial or graph versioning.

### 2026-06-24 — UX: collapsible Parameters area in the right panel
- The right panel's **Parameters** section is now collapsible so the **Properties** (inspector)
  area can take the full height. Added `paramsOpen` to `useLayout` (persisted); the Parameters
  sub-section gained a clickable header (chevron + title + live param count) that toggles its
  body. When collapsed, `.app__params` becomes `flex:0 0 auto` so the inspector grows to fill.
- Moved the "Parameters" title out of `ParamsPanel` into the new toggle header (no duplicate).
- Typecheck/lint/build clean.

### 2026-06-24 — UX: per-primitive transforms, palette drag-drop, visual tooltips
- **Per-primitive transform.** Every primitive now carries its own position/rotation°/scale
  (sockets tx..sz), so basic placement no longer needs a separate Transform node (which stays
  for transforming *combined* geometry like booleans/merges). New shared module
  `src/nodes/transformShared.ts` (`transformInputs`, `applyTransform`, `transformStatements`,
  `transformIsTrivial`) — the Transform modifier and the primitive factory both use it, so
  eval/codegen parity is preserved by construction. Codegen **omits** `applyMatrix4` when the
  transform is at identity (clean exports); emits it otherwise. +3 parity/codegen tests.
- **Inspector grouping.** Added optional `SocketSpec.group`; the Inspector renders grouped
  inputs in a collapsible `<details>` section (Transform is collapsed by default to keep the
  panel tidy). Field rendering extracted to `InspectorField`.
- **Palette drag-and-drop.** Palette items are now draggable onto the canvas (drop computes the
  flow position via `screenToFlowPosition`); clicking the `+` still adds. Shared MIME in
  `src/ui/dnd.ts`. Empty-state overlay already had `pointer-events:none`, so drops pass through.
- **Visual hover tooltip.** New `NodeThumbnail` (inline-SVG line art per primitive + per-category
  glyph, themed by category accent) and `NodeTooltip` (portal card: thumbnail, category chip,
  description, Inputs/Properties chips, built-in-transform note).
- **Decisions:** transform scoped to primitives only (generators/curves could adopt
  `transformInputs` later); thumbnails are inline SVG (no image assets to ship); triviality
  detected by comparing `inputExpr` to the default literal so params/edges always emit.
- 87/87 tests green; typecheck/lint/build clean. **Next:** Phase 7 (launch prep).

### 2026-06-24 — Fix: numeric inputs lost their inspector controls
- **Reported:** Time's Speed (and other numeric inputs) had no editable control — only a
  connection handle.
- **Cause:** making `number` connectable (for value nodes) meant the Inspector's
  `!isConnectableType` filter excluded ALL number inputs.
- **Fix:** split predicates — `isObjectType` (geometry/material/shape = edge-only, no inline
  control) vs `isConnectableType` (adds `number`). Inspector now filters on `isObjectType`,
  so numbers show a control when unconnected and "driven by a connected node" when wired.
  +3 predicate tests. 84/84 green.

### 2026-06-24 — Procedural animation (Time node + playback + animated export)
- **Did:** time clock end-to-end. `EvalContext.time` + `NodeDef.timeDependent`; engine
  `evaluateGraph(...,time)` with **time only in the hash for time-dependent nodes** (static
  subgraphs stay cached, animated path recomputes per frame, swept bounded). **Time** node
  (`value.time`, speed) → drives numeric inputs. Threaded time through worker/EvalService;
  hook gains a `playing` rAF loop (preview quality/frame, resumes from current time).
  Viewport **Play/Pause** (only for animated graphs). Codegen: vanilla `createModel(params,
  time)` (time arg only when animated); **R3F** animated variant (`useFrame`→`setTime`→
  `useMemo` keyed on time); `runGenerated(result, overrides, time)`. Added "Pulsing
  Asteroid" animated example.
- **Tests:** +6 (Time drives geometry over time, speed scaling, vanilla codegen parity at
  t=3, R3F useFrame structure, static graph not animated). 81/81 green.
- **Verified:** typecheck, 81 tests, lint, build, dev-boot clean.
- **Decisions/notes:** animation drives via a `time` value (procedural), not a keyframe
  timeline — matches the "export a generator" philosophy. Playback uses preview quality per
  frame for smoothness; export is always full. Timeline scrubber/loop range deferred.
- **Next:** Phase 7 launch prep.

### 2026-06-24 — Fix: ambient slider had no effect (added IBL environment)
- **Reported:** ambient slider made no visible difference.
- **Root cause:** `AmbientLight` only feeds the **diffuse** term, so metallic materials
  (steel/gold/chrome presets) barely responded — and the scene had **no environment map**,
  so metals/glass had nothing to reflect.
- **Fix:** added image-based lighting — `RoomEnvironment` baked via `PMREMGenerator` set as
  `scene.environment`, plus `ACESFilmicToneMapping`. The **ambient slider now drives
  `scene.environmentIntensity`** (with a small residual ambient light), so it visibly
  affects every material and metals/glass are now properly lit & reflective.
- **Verified:** typecheck, 74 tests, lint, build, dev-boot clean.

### 2026-06-24 — Viewport lighting control
- **Did:** `viewport/lighting.ts` (`Lighting` type, 5 presets: Studio/Soft/Dramatic/
  Bright/White Studio). Viewport now applies ambient/key (+ derived fill) intensities and
  background color from a `lighting` prop via a dedicated effect (no scene rebuild).
  `LightsControl` popover in the viewport toolbar (preset select + ambient/key sliders +
  background color); lighting persisted to localStorage. Helps preview the metal/glass
  material presets.
- **Verified:** typecheck, 74 tests, lint, build, dev-boot clean.

### 2026-06-24 — Phase 5 complete: Expression + Random value nodes
- **Did:** **Random** (`value.random` — deterministic [min,max] from seed) and
  **Expression** (`value.expression` — `a`,`b`,`Math` formula → number) nodes in a new
  **Value** category. Made **`number` sockets connectable** (`isConnectableType`) so value
  nodes drive scalar inputs — engine/codegen already resolve edges generically, so this
  was the key unlock. Added `randomUnit(seed)` (shared by eval + the Random codegen IIFE,
  parity-guaranteed) and `CodegenContext.rawInput` (emits the Expression formula raw, not
  quoted). Inspector shows "← driven by a connected node" + hides control/expose for wired
  inputs; number handles are lavender; Value category colored.
- **Tests:** +5 (random value-in-range, random→input parity, expression a*b+1, raw-formula
  codegen parity, invalid-formula→0 no-crash). 74/74 green.
- **Verified:** typecheck, 74 tests, lint, build, dev-boot clean.
- **Decisions/notes:** plain-text formula field (Monaco deferred as optional polish);
  invalid formulas return 0 rather than throwing (no red-flicker while typing). This
  **completes Phase 5** and lays the groundwork for procedural animation (a `time` input +
  these value nodes).
- **Next:** procedural animation milestone, or Phase 7 launch prep.

### 2026-06-24 — About modal + branding
- **Did:** `ui/AboutModal.tsx` — impactful About dialog (floating glow logo, app name +
  tagline, Early Access badge, description, credits — **Celso Silvestre** / **Azordev.pt**
  link, tech chips, year/copy). Header logo+title is now a button that opens it.
- **Verified:** typecheck, 69 tests, lint, build, dev-boot clean.

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
