# Examples

Built-in example graphs, defined in [`src/examples/index.ts`](../src/examples/index.ts)
and loadable from the app's toolbar **Examples** menu.

| Example | Pipeline | Exercises |
|---|---|---|
| **Asteroid** | Sphere → Displace → Material | deformers, seeded noise |
| **Beveled Gear** | Star → Extrude (bevel) → Transform → Material | curves, generators, materials |
| **Cored Cube** | Box, Sphere → Boolean (subtract) → Material | CSG, multi-input |

## `generated/` — exported code, proven to run

The `.mjs` files in [`generated/`](./generated) are the **actual three.js code exported**
from each example (identical to what the in-app *Export Code* button produces, just with
a `.mjs` extension so Node can run them directly).

They are verified two ways:

1. **Parity** — `src/test/examples.test.ts` runs each generated module in-process and
   asserts its geometry matches the live evaluation.
2. **Blank-project run** — they execute under plain Node with only `three` (and
   `three-bvh-csg` for the boolean example) installed — no app, no bundler:

   ```bash
   node examples/generated/_verify.mjs
   ```
   ```
   Asteroid: 2976 tris   material= MeshStandardMaterial
   Beveled Gear: 284 tris material= MeshPhysicalMaterial
   Cored Cube: 1539 tris material= MeshStandardMaterial
   ```

This is the M3 promise made concrete: **what you build in the viewport is what the
exported code produces.**
