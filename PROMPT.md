# Master Prompt — Procedural 3D Modeler for three.js

> This is the refined, canonical prompt describing **what we are building and why**.
> It is the north star for every design and implementation decision. When a choice is
> ambiguous, re-read this document. Update it only when the product vision changes
> (not for tactical changes — those go in `DEVELOPMENT_PLAN.md`).

## One-line definition

A browser-based, **node-graph procedural 3D modeling application** that lets users
author parametric geometry visually and exports **production-ready, parameterized
three.js code** (plus glTF/GLB and a re-editable graph format) for embedding in
three.js web applications.

## The problem we solve

three.js developers and technical artists need 3D content that is:

1. **Lightweight** — procedural code is kilobytes, not megabytes of baked mesh data.
2. **Parametric at runtime** — expose knobs (radius, segments, twist, seed) the host
   app can drive without a DCC round-trip.
3. **Deterministic & versionable** — geometry defined as code/graph, diffable in git.
4. **Native to three.js** — output uses `BufferGeometry`, standard materials, and
   idiomatic three.js APIs, with zero proprietary runtime dependency required.

Existing DCC tools (Blender, Houdini) export *baked assets*. We export *generators*.

## The end-game (definition of done for the product)

A user opens the app, builds a model by connecting nodes (primitives → modifiers →
output), tweaks exposed parameters live in a real-time viewport, and clicks **Export**
to get a self-contained TypeScript/JavaScript module:

```ts
// generated
export function createWidget(params = { radius: 1, twist: 0.5, seed: 42 }) {
  // ...idiomatic three.js BufferGeometry construction...
  return new THREE.Mesh(geometry, material);
}
```

They paste that into their three.js app and it just works.

## Non-negotiable product principles

- **Output quality is the product.** Generated code must be clean, readable,
  tree-shakeable, dependency-light, and something a senior three.js dev would
  approve in code review. This is the single highest priority.
- **Everything is parametric.** Any value a user types should be promotable to an
  exposed runtime parameter.
- **Non-destructive.** The node graph is the source of truth; operations never
  destroy upstream data.
- **Real-time feedback.** Viewport updates must feel instant; heavy work runs off
  the main thread.
- **No lock-in.** Graphs export to open formats (glTF, JSON, plain three.js code).
- **Determinism.** Same graph + same params + same seed ⇒ byte-identical geometry.

## Primary users

1. **three.js / creative-web developers** — want generators they can drop into apps.
2. **Technical artists** — want node-based control without writing math by hand.
3. **Game/product-config builders** — want runtime-parameterized models (configurators).

## What success looks like (commercial grade)

- Handles graphs of 100+ nodes and meshes of millions of triangles without freezing.
- Export produces code that passes lint/type-check and runs unmodified in a vanilla
  three.js project and in React Three Fiber.
- A new user can build and export a non-trivial model in under 10 minutes.
- Round-trips: export graph JSON → reimport → identical result.
- Stable enough to charge money for.

## Explicit non-goals (at least for v1)

- Not a general sculpting / digital-painting tool (no voxel/dynamic-topology sculpt).
- Not a full animation suite (basic parametric/procedural animation only).
- Not a replacement for Blender's full DCC pipeline.
- Not a multiplayer real-time collaborative editor in v1 (designed for it, not built).
