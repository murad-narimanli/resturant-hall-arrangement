export type Shape =
  | 'rectangle'
  | 'square'
  | 'circle'
  | 'organic'
  | 'sofa-straight'
  | 'sofa-corner'
  | 'sofa-semicircle'
  | 'sofa-circle';
export type Chair = {
  id: string;
  x: number;
  y: number;
  rotation: number;
  width?: number;
  height?: number;
};
export type Table = {
  id: string;
  hallId: string;
  name: string;
  shape: Shape;
  width: number;
  height: number;
  x: number;
  y: number;
  rotation: number;
  placed: boolean;
  chairs: Chair[];
};
export type Hall = {
  id: string;
  name: string;
  shape: 'rectangle' | 'square' | 'circle' | 'custom';
  width: number;
  height: number;
};
export type Document = { schemaVersion: 1; units: 'cm'; halls: Hall[]; tables: Table[] };
export const uid = () => crypto.randomUUID();
export function arrange(
  t: Pick<Table, 'width' | 'height' | 'shape'>,
  n: number,
  existing: Chair[] = [],
): Chair[] {
  if (t.shape.startsWith('sofa-')) return [];
  const gap =
    Math.max(17, ...existing.map((c) => Math.max(c.width ?? 34, c.height ?? 34) / 2)) + 10;
  const seats: { x: number; y: number; rotation: number }[] = [];
  if (t.shape === 'circle' || t.shape === 'organic') {
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n - Math.PI / 2;
      seats.push({
        x: Math.cos(a) * (t.width / 2 + gap),
        y: Math.sin(a) * (t.height / 2 + gap),
        rotation: (a * 180) / Math.PI + 90,
      });
    }
  } else {
    // Start with opposite sides, then distribute extra seats by available edge length.
    const counts = [0, 0, 0, 0],
      lengths = [t.width, t.width, t.height, t.height];
    for (let i = 0; i < n; i++) {
      const side =
        i < 4
          ? i
          : lengths.reduce(
              (best, len, j) =>
                len / (counts[j] + 1) > lengths[best] / (counts[best] + 1) ? j : best,
              0,
            );
      counts[side]++;
    }
    counts.forEach((count, side) => {
      for (let j = 0; j < count; j++) {
        const along = ((j + 1) * lengths[side]) / (count + 1) - lengths[side] / 2;
        seats.push(
          side < 2
            ? {
                x: along,
                y: (side === 0 ? -1 : 1) * (t.height / 2 + gap),
                rotation: side === 0 ? 0 : 180,
              }
            : {
                x: (side === 2 ? 1 : -1) * (t.width / 2 + gap),
                y: along,
                rotation: side === 2 ? 90 : -90,
              },
        );
      }
    });
  }
  return seats.map((position, i) => ({
    ...existing[i],
    id: existing[i]?.id ?? uid(),
    ...position,
  }));
}

export function seed(): Document {
  const halls: Hall[] = [
    { id: 'hall-main', name: 'Main hall', shape: 'rectangle', width: 1200, height: 800 },
    { id: 'hall-terrace', name: 'Terrace', shape: 'rectangle', width: 1000, height: 700 },
    { id: 'hall-vip', name: 'Private dining', shape: 'square', width: 800, height: 800 },
  ];
  const specs: [Shape, number, number, number, number, number][] = [
    ['rectangle', 160, 85, 250, 200, 6],
    ['circle', 100, 100, 600, 200, 4],
    ['square', 95, 95, 940, 200, 4],
    ['rectangle', 200, 90, 280, 530, 10],
    ['organic', 130, 115, 650, 530, 4],
    ['circle', 80, 80, 970, 530, 2],
  ];
  return {
    schemaVersion: 1,
    units: 'cm',
    halls,
    tables: halls.flatMap((h, hi) =>
      specs.map(([shape, width, height, x, y, n], i) => {
        const t = {
          id: `table-${hi + 1}-${i + 1}`,
          hallId: h.id,
          name: `Table ${String(i + 1).padStart(2, '0')}`,
          shape,
          width,
          height,
          x,
          y,
          rotation: 0,
          placed: hi === 0 && i < 5,
          chairs: [] as Chair[],
        };
        t.chairs = arrange(t, n);
        return t;
      }),
    ),
  };
}
export function validate(value: unknown): Document {
  const d = value as Document;
  if (
    !d ||
    d.schemaVersion !== 1 ||
    d.units !== 'cm' ||
    !Array.isArray(d.halls) ||
    !Array.isArray(d.tables) ||
    d.halls.length > 100 ||
    d.tables.length > 2000
  )
    throw Error('Invalid document structure or schema version.');
  const ids = new Set<string>();
  const id = (s: unknown) => {
    if (typeof s !== 'string' || !s || ids.has(s)) throw Error('IDs must be nonempty and unique.');
    ids.add(s);
  };
  const num = (n: unknown, min: number, max: number) => {
    if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max)
      throw Error('Invalid dimensions or coordinates.');
  };
  for (const h of d.halls) {
    id(h.id);
    if (
      typeof h.name !== 'string' ||
      !['rectangle', 'square', 'circle', 'custom'].includes(h.shape)
    )
      throw Error('Invalid hall.');
    num(h.width, 300, 3000);
    num(h.height, 300, 3000);
    if (h.shape === 'square' || h.shape === 'circle')
      if (h.width !== h.height) throw Error('Square and circle dimensions must match.');
  }
  for (const t of d.tables) {
    id(t.id);
    if (
      !d.halls.some((h) => h.id === t.hallId) ||
      typeof t.name !== 'string' ||
      typeof t.placed !== 'boolean' ||
      ![
        'rectangle',
        'square',
        'circle',
        'organic',
        'sofa-straight',
        'sofa-corner',
        'sofa-semicircle',
        'sofa-circle',
      ].includes(t.shape) ||
      !Array.isArray(t.chairs) ||
      t.chairs.length > 30
    )
      throw Error('Invalid table or hall relationship.');
    num(t.width, 40, 400);
    num(t.height, 40, 400);
    num(t.x, -5000, 5000);
    num(t.y, -5000, 5000);
    num(t.rotation, -360, 360);
    for (const c of t.chairs) {
      id(c.id);
      num(c.x, -5000, 5000);
      num(c.y, -5000, 5000);
      num(c.rotation, -360, 360);
      if (c.width !== undefined) num(c.width, 20, 100);
      if (c.height !== undefined) num(c.height, 20, 100);
    }
  }
  return d;
}
export const STORAGE = 'floorplan-empty-v2';

function furnitureBounds(t: Table) {
  const points: { x: number; y: number }[] = [];
  const box = (cx: number, cy: number, w: number, h: number, rotation: number) => {
    const a = (rotation * Math.PI) / 180;
    for (const x of [-w / 2, w / 2])
      for (const y of [-h / 2, h / 2])
        points.push({
          x: cx + x * Math.cos(a) - y * Math.sin(a),
          y: cy + x * Math.sin(a) + y * Math.cos(a),
        });
  };
  box(
    0,
    0,
    t.width * (t.shape === 'organic' ? 1.35 : 1),
    t.height * (t.shape === 'organic' ? 1.35 : 1),
    t.rotation,
  );
  const a = (t.rotation * Math.PI) / 180;
  for (const c of t.chairs)
    box(
      c.x * Math.cos(a) - c.y * Math.sin(a),
      c.x * Math.sin(a) + c.y * Math.cos(a),
      (c.width ?? 34) + 12,
      (c.height ?? 34) + 12,
      t.rotation + c.rotation,
    );
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}
export function fitTablesToHall(tables: Table[], hall: Hall): Table[] {
  const inset = hall.shape === 'circle' ? 1 / Math.SQRT2 : 1,
    pad = 8,
    left = (hall.width * (1 - inset)) / 2 + pad,
    top = (hall.height * (1 - inset)) / 2 + pad,
    right = hall.width - left,
    bottom = hall.height - top;
  return tables.map((original) => {
    if (original.hallId !== hall.id || !original.placed) return original;
    let t = { ...original, chairs: original.chairs.map((c) => ({ ...c })) };
    for (let i = 0; i < 8; i++) {
      const b = furnitureBounds(t),
        scale = Math.min(1, (right - left) / (b.maxX - b.minX), (bottom - top) / (b.maxY - b.minY));
      if (scale >= 0.99999) break;
      t = {
        ...t,
        width: Math.max(40, t.width * scale),
        height: Math.max(40, t.height * scale),
        chairs: t.chairs.map((c) => ({
          ...c,
          x: c.x * scale,
          y: c.y * scale,
          width: Math.max(20, (c.width ?? 34) * scale),
          height: Math.max(20, (c.height ?? 34) * scale),
        })),
      };
    }
    const b = furnitureBounds(t);
    return {
      ...t,
      x: Math.max(left - b.minX, Math.min(right - b.maxX, t.x)),
      y: Math.max(top - b.minY, Math.min(bottom - b.maxY, t.y)),
    };
  });
}
