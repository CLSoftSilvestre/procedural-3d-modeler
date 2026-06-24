import { create_asteroid } from './asteroid.mjs';
import { create_gear } from './gear.mjs';
import { create_cored_cube } from './cored-cube.mjs';

console.log("Running generated modules with only three installed:\n");
  { const m = create_asteroid(); m.geometry.computeBoundingBox(); const tri=(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3; console.log('Asteroid:', tri, 'tris', 'material=', m.material.type); }
  { const m = create_gear(); m.geometry.computeBoundingBox(); const tri=(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3; console.log('Beveled Gear:', tri, 'tris', 'material=', m.material.type); }
  { const m = create_cored_cube(); m.geometry.computeBoundingBox(); const tri=(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3; console.log('Cored Cube:', tri, 'tris', 'material=', m.material.type); }
console.log("\nAll generated modules executed successfully.");
