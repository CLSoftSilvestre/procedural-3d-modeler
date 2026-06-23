# Development Plan — Procedural 3D Modeler for three.js

> **This is the single source of truth for the project.**
> Read it at the start of every session. **Update it at the end of every session**
> (status checkboxes, the Session Log, and Next Up). Companion docs:
> `PROMPT.md` (vision), `ARCHITECTURE.md` (how it's built).

- **Status:** Phase 2 complete — **M1 reached** (worker eval + caching, undo/redo, save/load, validation).
- **Last updated:** 2026-06-23
- **Current phase:** Phase 3 (Modeling toolkit) — not started.

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

## Phase 3 — Modeling toolkit (→ M2)  `[ ]`
- [ ] Primitives: sphere, cylinder, cone, torus, plane, circle
- [ ] Transform node (translate/rotate/scale)
- [ ] Array (linear/radial/grid), mirror
- [ ] Curves + extrude + lathe/revolve
- [ ] Booleans via three-bvh-csg (union/subtract/intersect)
- [ ] Displace (seeded noise), twist/bend/taper deformers
- [ ] Subdivide / smooth / bevel
- [ ] Normals + UV utilities, vertex color
- [ ] Material node (standard/physical) + assignment
- **Exit criteria (M2):** can build a non-trivial model (e.g. a parametric goblet or
  modular building) end-to-end in the viewport.

## Phase 4 — Code generation MVP (→ M3)  `[ ]`
- [ ] `CodeFragment` model + import deduping + Prettier formatting
- [ ] `codegen` for every existing node (parity with `evaluate`)
- [ ] Target A: vanilla three.js ES module export
- [ ] **Parity test harness:** eval(graph) === eval(generated code) within epsilon
- [ ] Export UI (preview generated code, copy, download)
- **Exit criteria (M3):** export a model → generated module runs unmodified in a
  blank three.js project and matches the viewport.

## Phase 5 — Parametric system (→ M4)  `[ ]`
- [ ] Promote any input to an exposed `ExposedParam` (name, type, min/max/step, default)
- [ ] Params panel with live controls (sliders, color, vector, bool, enum)
- [ ] Param-driven re-eval (fast preview while dragging)
- [ ] Expression nodes (Monaco) referencing params; seeded random node
- [ ] Codegen emits `function createX(params = {...})` honoring exposed params
- [ ] Export targets B (R3F component) and D (graph JSON) finalized
- **Exit criteria (M4):** exported generator is runtime-parameterized and drives a live
  demo (configurator-style) from host code.

## Phase 6 — Commercial polish (→ M5)  `[ ]`
- [ ] Performance pass: LOD/preview quality, worker pool, large-graph profiling
- [ ] Robust error handling + node error surfacing (no white-screen crashes)
- [ ] glTF/GLB export (Target C)
- [ ] UX: node search/palette, keyboard shortcuts, copy/paste nodes, groups/comments
- [ ] Viewport tools: transform gizmos, wireframe/normals/stats overlays
- [ ] Autosave, local project storage, recent files
- [ ] Theming, responsive layout, accessibility pass
- [ ] User docs + in-app help/tooltips per node
- **Exit criteria (M5):** stable, fast, pleasant; no known data-loss or crash bugs.

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
1. Refactor node-authoring ergonomics first: typed input helpers (`numIn`, `vec3In`),
   and support **multi-input geometry sockets** + nodes that take a geometry input
   (needed for modifiers/booleans). Engine currently assumes single-output; confirm
   modifier nodes (geometry-in → geometry-out) work end-to-end.
2. Primitives: sphere, cylinder, cone, torus, plane, circle (+ codegen each).
3. Transform node (translate/rotate/scale) — first geometry-modifying node.
4. Array (linear/radial/grid) and mirror.
5. Booleans via three-bvh-csg (union/subtract/intersect) behind a wrapper + fixtures.
6. Deformers: displace (seeded noise), twist/bend/taper; subdivide/smooth.
7. Material node + assignment; normals/UV utilities.

## Deferred / tech-debt (carried forward)
- **Transferable GeometryData** across the worker boundary (currently structured-cloned).
  Optimize in Phase 6 perf pass; cache keeps master copies so transfer needs care.
- **CI** (GitHub Actions: typecheck + lint + test) + **Playwright** smoke test — set up
  early in Phase 3 to protect the growing node library.
- Inspector controls for vector/color/select kinds (only number/slider/checkbox/text now).

---

## Session Log
> Append newest entries at the top. One entry per working session.
> Format: date — what was done — decisions — what's next.

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
