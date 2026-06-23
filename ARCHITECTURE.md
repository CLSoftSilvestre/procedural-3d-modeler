# Architecture

> How the system is built. Companion to `PROMPT.md` (the *why*) and
> `DEVELOPMENT_PLAN.md` (the *when/what-next*). Update when structural decisions change;
> record the decision in the ADR log at the bottom.

## 1. High-level shape

```
┌──────────────────────────────────────────────────────────────────────┐
│                              UI (React)                                │
│  ┌────────────┐  ┌──────────────┐  ┌────────────┐  ┌───────────────┐  │
│  │ Node Graph │  │  3D Viewport  │  │ Inspector  │  │ Param Panel   │  │
│  │ (React Flow)│  │  (three.js)  │  │ (node props)│  │ (exposed vars)│  │
│  └─────┬──────┘  └──────▲───────┘  └─────┬──────┘  └──────┬────────┘  │
└────────┼────────────────┼────────────────┼────────────────┼──────────┘
         │ edits          │ render         │ edits          │ edits
         ▼                │                ▼                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     App State (Zustand + Immer)                        │
│   graph (nodes/edges) · params · selection · viewport settings        │
└────────────────────────────────┬─────────────────────────────────────┘
                                  │ graph + params (serializable)
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  Evaluation Engine (in Web Worker)                     │
│   topo-sort → dirty propagation → node eval → geometry cache           │
│   produces GeometryData (transferable buffers)                         │
└───────────────┬───────────────────────────────────┬──────────────────┘
                │ GeometryData                       │ graph IR
                ▼                                     ▼
        ┌───────────────┐                   ┌──────────────────┐
        │ Viewport mesh │                   │  Code Generator  │
        │ (main thread) │                   │  (export targets)│
        └───────────────┘                   └──────────────────┘
```

**Key principle:** The graph is pure data. The evaluation engine is a pure function
`(graph, params) → GeometryData`. The viewport and the code generator are two
*consumers* of the same evaluated result — one renders it, one prints code that
reproduces it. This guarantees "what you see is what you export."

## 2. Tech stack (decided)

| Concern | Choice | Rationale |
|---|---|---|
| Language | **TypeScript (strict)** | Safety across geometry math + codegen. |
| Build/dev | **Vite** | Fast HMR, first-class worker + WASM support. |
| UI | **React 18** | Ecosystem, React Flow, R3F option later. |
| State | **Zustand + Immer** | Minimal, fast, easy undo/redo via patches. |
| Node editor | **@xyflow/react (React Flow)** | Mature, customizable node graph UI. |
| 3D engine | **three.js** | The target runtime — dogfood it in the editor. |
| Booleans/CSG | **three-bvh-csg + three-mesh-bvh** | Best-in-class web mesh booleans + raycast accel. |
| Heavy compute | **Web Workers + Comlink** | Keep main thread at 60fps. |
| Code/script nodes | **Monaco editor** | VS Code-grade editing for expression/script nodes. |
| Export (baked) | **GLTFExporter** | Standard interchange. |
| Testing | **Vitest** (unit) + **Playwright** (e2e) | Geometry determinism + UI flows. |
| Lint/format | **ESLint + Prettier** | Also used to format generated output. |

> ADR-001 through ADR-00x record why each was chosen — see bottom.

## 3. Core data model

### GeometryData (the intermediate representation everything flows through)
A flat, transferable, three.js-friendly mesh buffer:

```ts
interface GeometryData {
  positions: Float32Array;          // xyz triples
  indices?: Uint32Array;            // optional, triangle list
  normals?: Float32Array;
  uvs?: Float32Array;
  // named extra attributes (color, custom): name -> {array, itemSize}
  attributes?: Record<string, { array: Float32Array; itemSize: number }>;
  groups?: { start: number; count: number; materialIndex: number }[];
  metadata: { boundingBox?: Box3; triCount: number };
}
```

This maps 1:1 onto `THREE.BufferGeometry` and is what the code generator knows how
to print. It is *transferable* so workers can hand it back with zero copy.

### Graph IR
```ts
interface Graph {
  version: string;
  nodes: GraphNode[];          // id, type, position, inputs (literal values)
  edges: Edge[];               // from(nodeId, socket) -> to(nodeId, socket)
  params: ExposedParam[];      // promoted, runtime-exposed parameters
  outputNodeId: string;
}
```

### Node definition (plugin contract — every node implements this)
```ts
interface NodeDef<I, O> {
  type: string;                       // "primitive.box"
  category: string;                   // "Primitives" | "Modifiers" | ...
  inputs: SocketSpec[];               // typed sockets + UI control hints
  outputs: SocketSpec[];
  evaluate(inputs: I, ctx: EvalContext): O;     // pure
  codegen(inputs: CodegenInputs, ctx: CodegenContext): CodeFragment; // pure
}
```

**The dual `evaluate` / `codegen` contract is the heart of the system.** Every node
must be able to both *do* the operation (for the viewport) and *emit code* that does
the same operation (for export). They are tested against each other for parity.

## 4. Evaluation engine

- Build a DAG from edges; **topological sort**.
- **Dirty tracking:** a param/node change marks downstream nodes dirty; only dirty
  subgraphs re-evaluate. Clean nodes serve cached `GeometryData`.
- **Content-hash cache:** each node's output keyed by `hash(nodeType, resolvedInputs)`
  so identical subgraphs share results and undo/redo is cheap.
- Runs in a **Web Worker**; results transferred to main thread for rendering.
- Deterministic RNG (seeded, e.g. mulberry32) injected via `EvalContext` so randomness
  is reproducible across eval and codegen.

## 5. Code generation (the product's crown jewel)

Strategy: each node's `codegen` returns a `CodeFragment` (statements + an output
variable name + required imports). The generator walks the topo-sorted graph, stitches
fragments, dedupes imports, runs the result through Prettier, and wraps it in the
chosen **export target template**:

- **Target A — Vanilla three.js module:** `export function createX(params){...}`.
- **Target B — React Three Fiber component.**
- **Target C — glTF/GLB (baked)** via runtime eval + `GLTFExporter`.
- **Target D — Graph JSON** (re-editable, the native save format).

A **parity test** evaluates the graph directly and also runs the generated code in a
headless context, then asserts the two `GeometryData` results are identical
(within float epsilon). This is how we keep "what you see is what you export" honest.

## 6. Node taxonomy (initial)

- **Primitives:** box, sphere (uv/ico), cylinder, cone, torus, plane, circle, text.
- **Curves:** line, bezier, spline, profile.
- **Generators:** extrude, lathe/revolve, sweep (profile along curve), loft.
- **Modifiers:** transform, array (linear/radial/grid), mirror, subdivide, bevel,
  smooth, displace (noise), twist, bend, taper, wireframe, decimate.
- **Boolean:** union, subtract, intersect (three-bvh-csg).
- **Attributes:** set/transform UVs, vertex color, normals recompute.
- **Material:** standard/physical material, assign.
- **Math/Utility:** value, vector, expression (Monaco), random (seeded), switch.
- **Output:** the terminal node that defines what gets exported.

## 7. Performance budget

- Viewport 60fps for graphs up to ~100 nodes / a few M triangles.
- Re-eval of a single changed param: < 16ms for small graphs, async (worker) otherwise.
- Worker results use transferables (no structured-clone copies of big buffers).
- LOD/preview-quality toggle: cheap preview while dragging sliders, full quality on release.

## 8. Repository layout (target)

```
src/
  app/            # shell, layout, routing
  state/          # zustand stores, undo/redo
  graph/          # graph types, serialization, validation
  nodes/          # node definitions (one folder per category)
    _registry.ts  # node registration
  engine/         # evaluation engine, cache, scheduler
    worker/       # worker entry + comlink bindings
  geometry/       # GeometryData helpers, math, RNG, CSG wrappers
  codegen/        # fragment model, target templates, formatter
  viewport/       # three.js scene, controls, gizmos
  ui/             # panels: graph, inspector, params, viewport chrome
  export/         # gltf, file save/load
  test/           # parity harness, fixtures
```

## 9. ADR log (Architecture Decision Records)

- **ADR-001 — Node-graph paradigm over script-first or form-based.** Chosen for
  non-destructive parametric workflow + visual discoverability; script power retained
  via expression/script nodes. (2026-06-23)
- **ADR-002 — Dual evaluate/codegen node contract.** Guarantees viewport↔export parity;
  every node carries both. (2026-06-23)
- **ADR-003 — GeometryData flat-buffer IR.** Transferable to workers, 1:1 with
  BufferGeometry, directly printable by codegen. (2026-06-23)
- **ADR-004 — Evaluation in Web Worker with dirty+hash caching.** Main-thread fps + cheap
  undo/redo. (2026-06-23)
- **ADR-005 — three-bvh-csg for booleans.** Best maintained web mesh-boolean lib. (2026-06-23)
- **ADR-006 — Material as a separate socket type, combined at Output.** Rather than
  bundling geometry+material into one flowing value, materials travel on their own
  `material` socket (`MaterialSpec`, a plain serializable PBR description) and are joined
  only at the Output node's second input. Keeps all geometry modifiers unaware of
  materials, keeps one value type per socket, and matches node-graph conventions. The
  engine returns `{ geometry, material }` from Output; the viewport builds the three.js
  material (default if none connected). Sockets whose type is "connectable"
  (`geometry`/`material`) render a handle; scalars are edited in the inspector. (2026-06-23)
- _Add new ADRs here as decisions are made._
