import { defaultMaterialSpec, type MaterialSpec } from '@/material/MaterialData';
import type { NodeDef } from '../NodeDef';
import { bool, num, str } from '../helpers';

/**
 * Material — produces a PBR MaterialSpec on a 'material' socket. Connect its output to
 * the Output node's Material input. Standalone (no geometry input) so the same material
 * can be authored independently of the mesh.
 */
export const materialNode: NodeDef = {
  type: 'material.standard',
  category: 'Material',
  label: 'Material',
  description: 'A PBR material (standard/physical) for the Output node.',
  inputs: [
    {
      id: 'type',
      label: 'Type',
      type: 'string',
      default: 'standard',
      control: {
        kind: 'select',
        options: [
          { label: 'Standard', value: 'standard' },
          { label: 'Physical', value: 'physical' },
        ],
      },
    },
    { id: 'color', label: 'Color', type: 'color', default: '#6ea8fe', control: { kind: 'color' } },
    { id: 'roughness', label: 'Roughness', type: 'number', default: 0.5, control: { kind: 'slider', min: 0, max: 1, step: 0.01 } },
    { id: 'metalness', label: 'Metalness', type: 'number', default: 0.05, control: { kind: 'slider', min: 0, max: 1, step: 0.01 } },
    { id: 'opacity', label: 'Opacity', type: 'number', default: 1, control: { kind: 'slider', min: 0, max: 1, step: 0.01 } },
    { id: 'flatShading', label: 'Flat Shading', type: 'boolean', default: false, control: { kind: 'checkbox' } },
    { id: 'wireframe', label: 'Wireframe', type: 'boolean', default: false, control: { kind: 'checkbox' } },
  ],
  outputs: [{ id: 'material', label: 'Material', type: 'material' }],

  evaluate(inputs) {
    const spec: MaterialSpec = {
      ...defaultMaterialSpec(),
      type: str(inputs, 'type', 'standard') === 'physical' ? 'physical' : 'standard',
      color: str(inputs, 'color', '#6ea8fe'),
      roughness: num(inputs, 'roughness', 0.5),
      metalness: num(inputs, 'metalness', 0.05),
      opacity: num(inputs, 'opacity', 1),
      flatShading: bool(inputs, 'flatShading', false),
      wireframe: bool(inputs, 'wireframe', false),
    };
    return spec;
  },

  codegen(ctx) {
    const v = ctx.uniqueVar('material');
    const ctor = `${ctx.inputExpr('type')} === 'physical' ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial`;
    return {
      statements: [
        `const ${v} = new (${ctor})({`,
        `  color: new THREE.Color(${ctx.inputExpr('color')}),`,
        `  roughness: ${ctx.inputExpr('roughness')},`,
        `  metalness: ${ctx.inputExpr('metalness')},`,
        `  flatShading: ${ctx.inputExpr('flatShading')},`,
        `  wireframe: ${ctx.inputExpr('wireframe')},`,
        `  transparent: ${ctx.inputExpr('opacity')} < 1,`,
        `  opacity: ${ctx.inputExpr('opacity')},`,
        `});`,
      ],
      outputVar: v,
      imports: ['three'],
    };
  },
};
