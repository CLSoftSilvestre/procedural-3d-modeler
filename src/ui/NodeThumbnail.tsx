/**
 * Lightweight inline-SVG illustrations shown in the palette hover tooltip — a quick
 * visual of what each node produces. Primitives get a recognisable 3D-ish line drawing;
 * other nodes fall back to a per-category glyph. All stroke/fill colors inherit the category
 * accent passed in, so they stay on-theme with no image assets to ship.
 */

type Draw = (a: string) => JSX.Element;

const BY_TYPE: Record<string, Draw> = {
  'primitive.box': (a) => (
    <g stroke={a} fill={a} fillOpacity={0.12} strokeWidth={2} strokeLinejoin="round">
      <path d="M60 12 96 28v30L60 74 24 58V28z" />
      <path d="M24 28 60 44 96 28M60 44v30" fill="none" />
    </g>
  ),
  'primitive.sphere': (a) => (
    <g stroke={a} fill="none" strokeWidth={2}>
      <circle cx="60" cy="43" r="30" fill={a} fillOpacity={0.12} />
      <ellipse cx="60" cy="43" rx="30" ry="11" />
      <ellipse cx="60" cy="43" rx="11" ry="30" />
    </g>
  ),
  'primitive.cylinder': (a) => (
    <g stroke={a} strokeWidth={2} strokeLinejoin="round">
      <path d="M30 22v42a30 11 0 0 0 60 0V22" fill={a} fillOpacity={0.12} />
      <ellipse cx="60" cy="22" rx="30" ry="11" fill={a} fillOpacity={0.2} />
    </g>
  ),
  'primitive.cone': (a) => (
    <g stroke={a} strokeWidth={2} strokeLinejoin="round">
      <path d="M60 10 90 64a30 11 0 0 1-60 0z" fill={a} fillOpacity={0.12} />
      <path d="M30 64a30 11 0 0 0 60 0" fill="none" />
    </g>
  ),
  'primitive.torus': (a) => (
    <g stroke={a} strokeWidth={2} fill="none">
      <ellipse cx="60" cy="43" rx="32" ry="18" fill={a} fillOpacity={0.12} />
      <ellipse cx="60" cy="43" rx="13" ry="6" />
    </g>
  ),
  'primitive.plane': (a) => (
    <g stroke={a} strokeWidth={2} strokeLinejoin="round">
      <path d="M22 56 52 24h46L68 56z" fill={a} fillOpacity={0.12} />
      <path d="M37 40h46M52 56l15-16M53 40 68 24" fill="none" strokeWidth={1.2} opacity={0.7} />
    </g>
  ),
  'primitive.capsule': (a) => (
    <g stroke={a} strokeWidth={2} strokeLinejoin="round">
      <rect x="44" y="12" width="32" height="62" rx="16" fill={a} fillOpacity={0.12} />
      <ellipse cx="60" cy="28" rx="16" ry="6" fill="none" opacity={0.6} />
    </g>
  ),
  'primitive.circle': (a) => (
    <ellipse cx="60" cy="44" rx="34" ry="20" stroke={a} strokeWidth={2} fill={a} fillOpacity={0.16} />
  ),
  'primitive.ring': (a) => (
    <path
      d="M26 44a34 20 0 1 0 68 0a34 20 0 1 0-68 0M44 44a16 9 0 1 0 32 0a16 9 0 1 0-32 0"
      fillRule="evenodd"
      stroke={a}
      strokeWidth={2}
      fill={a}
      fillOpacity={0.16}
    />
  ),
  'primitive.torusKnot': (a) => (
    <g stroke={a} strokeWidth={2} fill={a} fillOpacity={0.08}>
      <circle cx="60" cy="31" r="16" />
      <circle cx="71" cy="50" r="16" />
      <circle cx="49" cy="50" r="16" />
    </g>
  ),
  'primitive.tetrahedron': (a) => (
    <g stroke={a} strokeWidth={2} fill={a} fillOpacity={0.12} strokeLinejoin="round">
      <path d="M60 14 30 66h60z" />
      <path d="M60 14 62 48M30 66 62 48M90 66 62 48" fill="none" opacity={0.7} />
    </g>
  ),
  'primitive.octahedron': (a) => (
    <g stroke={a} strokeWidth={2} fill={a} fillOpacity={0.12} strokeLinejoin="round">
      <path d="M60 11 92 43 60 75 28 43z" />
      <path d="M28 43h64M60 11v64" fill="none" opacity={0.6} />
    </g>
  ),
  'primitive.dodecahedron': (a) => (
    <g stroke={a} strokeWidth={2} fill={a} fillOpacity={0.12} strokeLinejoin="round">
      <path d="M60 11 90 33 79 69 41 69 30 33z" />
      <path d="M60 29 73 39 68 54 52 54 47 39z" fill="none" opacity={0.7} />
      <path d="M60 11 60 29M90 33 73 39M79 69 68 54M41 69 52 54M30 33 47 39" fill="none" opacity={0.45} />
    </g>
  ),
  'primitive.icosahedron': (a) => (
    <g stroke={a} strokeWidth={2} fill={a} fillOpacity={0.12} strokeLinejoin="round">
      <path d="M60 11 88 27 88 59 60 75 32 59 32 27z" />
      <path d="M60 27 74 51 46 51z" fill="none" opacity={0.7} />
      <path
        d="M60 27 60 11M74 51 88 27M74 51 88 59M46 51 32 27M46 51 32 59M74 51 60 75M46 51 60 75"
        fill="none"
        opacity={0.45}
      />
    </g>
  ),
  'deformer.bend': (a) => (
    <g fill="none" strokeLinecap="round">
      <path d="M36 72V30" stroke={a} strokeWidth={2} strokeDasharray="4 5" opacity={0.4} />
      <path d="M36 72Q36 32 78 30" stroke={a} strokeWidth={8} />
    </g>
  ),
};

const CATEGORIES: Record<string, Draw> = {
  Curves: (a) => (
    <path
      d="M60 12 70 38h28L75 54l9 28-24-17-24 17 9-28L22 38h28z"
      stroke={a}
      strokeWidth={2}
      fill={a}
      fillOpacity={0.12}
      strokeLinejoin="round"
    />
  ),
  Generators: (a) => (
    <g stroke={a} strokeWidth={2} strokeLinejoin="round">
      <path d="M28 30h26v26H28z" fill="none" />
      <path d="M66 24h26v26H66z" fill={a} fillOpacity={0.14} />
      <path d="M54 38 66 32M54 50l12 6" fill="none" />
    </g>
  ),
  Modifiers: (a) => (
    <g stroke={a} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M60 16v54M33 43h54" />
      <path d="M60 16l-7 8M60 16l7 8M60 70l-7-8M60 70l7-8M33 43l8-7M33 43l8 7M87 43l-8-7M87 43l-8 7" />
    </g>
  ),
  Deformers: (a) => (
    <g stroke={a} strokeWidth={2} fill="none" strokeLinecap="round">
      <path d="M20 32q10-16 20 0t20 0 20 0 20 0" />
      <path d="M20 54q10-16 20 0t20 0 20 0 20 0" opacity={0.6} />
    </g>
  ),
  Booleans: (a) => (
    <g stroke={a} strokeWidth={2}>
      <circle cx="48" cy="43" r="22" fill={a} fillOpacity={0.14} />
      <circle cx="72" cy="43" r="22" fill={a} fillOpacity={0.14} />
    </g>
  ),
  Material: (a) => (
    <g stroke={a} strokeWidth={2}>
      <circle cx="60" cy="43" r="28" fill={a} fillOpacity={0.16} />
      <circle cx="50" cy="33" r="6" fill={a} stroke="none" opacity={0.8} />
    </g>
  ),
  Value: (a) => (
    <g stroke={a} strokeWidth={2} fill="none" strokeLinecap="round">
      <circle cx="60" cy="43" r="26" fill={a} fillOpacity={0.1} />
      <path d="M60 27v16l11 8" />
    </g>
  ),
  Output: (a) => (
    <g stroke={a} strokeWidth={2} fill="none" strokeLinejoin="round">
      <path d="M26 24h68v38H26z" fill={a} fillOpacity={0.1} />
      <path d="M50 70h20M60 62v8" />
    </g>
  ),
};

const FALLBACK: Draw = (a) => (
  <rect x="32" y="20" width="56" height="46" rx="8" stroke={a} strokeWidth={2} fill={a} fillOpacity={0.12} />
);

export function NodeThumbnail({
  type,
  category,
  accent,
}: {
  type: string;
  category: string;
  accent: string;
}) {
  const draw = BY_TYPE[type] ?? CATEGORIES[category] ?? FALLBACK;
  return (
    <svg viewBox="0 0 120 86" className="node-thumb" aria-hidden="true">
      {draw(accent)}
    </svg>
  );
}
