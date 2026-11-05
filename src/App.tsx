import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
const View3D = lazy(() => import('./View3D'));
import type { PointerEvent as PE } from 'react';
import { arrange, fitTablesToHall, STORAGE, uid, validate } from './model';
import type { Document, Hall, Table, Shape } from './model';
const labels: Record<Shape, string> = {
  rectangle: 'Rectangle',
  square: 'Square',
  circle: 'Round',
  organic: 'Organic',
  'sofa-straight': 'Straight sofa',
  'sofa-corner': 'L-shaped sofa',
  'sofa-semicircle': 'Semicircular sofa',
  'sofa-circle': 'Circular sofa',
};
function Icon({ name }: { name: string }) {
  return (
    <img
      className="icon"
      src={`/icons/${name}.svg`}
      alt=""
      width="24"
      height="24"
      draggable={false}
    />
  );
}
type Hint = { text: string; x: number; y: number } | null;
function TransformHandle({
  x,
  y,
  kind,
  id,
  onDrag,
  onHint,
  label,
  rotation = 0,
}: {
  x: number;
  y: number;
  kind: 'resize' | 'rotate' | 'plus' | 'copy' | 'trash';
  id: string;
  label?: string;
  rotation?: number;
  onDrag: (e: PE) => void;
  onHint: (hint: Hint) => void;
}) {
  const text =
    label ??
    (kind === 'trash'
      ? 'Delete'
      : kind === 'copy'
        ? 'Duplicate table with chairs'
        : kind === 'plus'
          ? 'Add chair'
          : kind === 'resize'
            ? 'Drag to resize'
            : 'Drag to rotate');
  return (
    <g
      data-handle={id}
      className={`icon-handle ${kind}`}
      transform={`translate(${x} ${y})`}
      onPointerDown={(e) => {
        onHint(null);
        onDrag(e);
      }}
      onPointerEnter={(e) => onHint({ text, x: e.clientX, y: e.clientY })}
      onPointerLeave={() => onHint(null)}
    >
      <g className="handle-visual" transform={`rotate(${-rotation}) scale(.65)`}>
        <rect x="-17" y="-17" width="34" height="34" rx="9" />
        <image
          href={`/icons/${kind}.svg`}
          x="-12"
          y="-12"
          width="24"
          height="24"
          pointerEvents="none"
        />
      </g>
    </g>
  );
}
function resizeHandlePosition(t: Table) {
  const obstacles = t.chairs.map((c) => {
    const a = (c.rotation * Math.PI) / 180,
      w = (c.width ?? 34) / 2 + 7,
      h = (c.height ?? 34) / 2 + 7;
    return {
      x: c.x,
      y: c.y,
      dx: Math.abs(Math.cos(a)) * w + Math.abs(Math.sin(a)) * h,
      dy: Math.abs(Math.sin(a)) * w + Math.abs(Math.cos(a)) * h,
    };
  });
  for (let offset = 0; offset <= 6000; offset += 2) {
    const x = t.width / 2 + 8 + offset,
      y = t.height / 2 + 8 + offset;
    if (!obstacles.some((c) => Math.abs(x - c.x) < c.dx + 14 && Math.abs(y - c.y) < c.dy + 14))
      return { x, y };
  }
  return { x: t.width / 2 + 8, y: t.height / 2 + 8 };
}
function SofaGeometry({ table: t }: { table: Table }) {
  const w = t.width,
    h = t.height,
    depth = Math.min(w, h) * 0.32;
  if (t.shape === 'sofa-corner')
    return (
      <g className="sofa-geometry">
        <path
          d={`M ${-w / 2} ${-h / 2} H ${w / 2} V ${-h / 2 + depth} H ${-w / 2 + depth} V ${h / 2} H ${-w / 2} Z`}
        />
        <path
          className="sofa-seam"
          d={`M ${-w / 2 + 8} ${h / 2 - 6} V ${-h / 2 + 8} H ${w / 2 - 6} M ${-w / 2 + depth} ${-h / 2 + depth} L ${-w / 2 + 8} ${-h / 2 + 8}`}
        />
      </g>
    );
  if (t.shape === 'sofa-circle')
    return (
      <g className="sofa-geometry">
        <path
          fillRule="evenodd"
          d={`M ${-w / 2} 0 a ${w / 2} ${h / 2} 0 1 0 ${w} 0 a ${w / 2} ${h / 2} 0 1 0 ${-w} 0 M ${-w / 2 + depth} 0 a ${w / 2 - depth} ${h / 2 - depth} 0 1 0 ${w - depth * 2} 0 a ${w / 2 - depth} ${h / 2 - depth} 0 1 0 ${-w + depth * 2} 0`}
        />
      </g>
    );
  if (t.shape === 'sofa-semicircle')
    return (
      <g className="sofa-geometry">
        <path
          d={`M ${-w / 2} ${h / 2} A ${w / 2} ${h} 0 0 1 ${w / 2} ${h / 2} L ${w / 2 - depth} ${h / 2} A ${Math.max(1, w / 2 - depth)} ${h - depth} 0 0 0 ${-w / 2 + depth} ${h / 2} Z`}
        />
        <path
          className="sofa-seam"
          d={`M ${-w / 2 + 7} ${h / 2} A ${w / 2 - 7} ${h - 7} 0 0 1 ${w / 2 - 7} ${h / 2}`}
        />
      </g>
    );
  return (
    <g className="sofa-geometry">
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx="10" />
      <rect
        className="sofa-back"
        x={-w / 2 + 5}
        y={-h / 2 + 5}
        width={w - 10}
        height={h * 0.22}
        rx="5"
      />
      <path
        className="sofa-seam"
        d={`M ${-w / 2 + w * 0.08} ${-h / 2 + h * 0.25} V ${h / 2 - 5} M ${w / 2 - w * 0.08} ${-h / 2 + h * 0.25} V ${h / 2 - 5} M ${-w / 6} ${-h / 2 + h * 0.27} V ${h / 2 - 5} M ${w / 6} ${-h / 2 + h * 0.27} V ${h / 2 - 5}`}
      />
    </g>
  );
}
function actionHandlePositions(t: Table) {
  const obstacles = t.chairs.map((c) => {
    const a = (c.rotation * Math.PI) / 180,
      w = (c.width ?? 34) / 2 + 7,
      h = (c.height ?? 34) / 2 + 7;
    return {
      x: c.x,
      y: c.y,
      dx: Math.abs(Math.cos(a)) * w + Math.abs(Math.sin(a)) * h,
      dy: Math.abs(Math.sin(a)) * w + Math.abs(Math.cos(a)) * h,
    };
  });
  const used: { x: number; y: number }[] = [];
  const find = (x: number, y: number, vertical = false) => {
    for (let offset = 0; offset < 6000; offset += 2) {
      const point = { x: x + (vertical ? 0 : offset), y: y - (vertical ? offset : 0) };
      if (
        !obstacles.some(
          (c) => Math.abs(point.x - c.x) < c.dx + 14 && Math.abs(point.y - c.y) < c.dy + 14,
        ) &&
        !used.some((c) => Math.abs(point.x - c.x) < 28 && Math.abs(point.y - c.y) < 28)
      ) {
        used.push(point);
        return point;
      }
    }
    return { x, y };
  };
  return {
    copy: find(t.width / 2 + 26, -18),
    add: find(t.width / 2 + 26, 18),
    trash: find(t.width / 2 + 26, -54),
    rotate: find(0, -t.height / 2 - 28, true),
  };
}
function TableLabel({ table: t }: { table: Table }) {
  const name = useRef<SVGTSpanElement>(null),
    guests = useRef<SVGTSpanElement>(null);
  const [textWidth, setTextWidth] = useState(0);
  useEffect(() => {
    const measure = () =>
      setTextWidth(
        Math.max(
          name.current?.getComputedTextLength() ?? 0,
          guests.current?.getComputedTextLength() ?? 0,
        ),
      );
    measure();
    void document.fonts.ready.then(measure);
  }, [t.name, t.chairs.length]);
  // Keep upright text within the usable inscribed area, including rotated tables.
  const angle = (t.rotation * Math.PI) / 180,
    c = Math.abs(Math.cos(angle)),
    s = Math.abs(Math.sin(angle));
  const inset = t.shape === 'circle' || t.shape === 'organic' ? 0.62 : 0.8;
  const width = t.width * inset,
    height = t.height * inset;
  const scale = Math.min(
    1,
    width / Math.max(1, textWidth * c + 38 * s),
    height / Math.max(1, textWidth * s + 38 * c),
  );
  return (
    <text textAnchor="middle" transform={`rotate(${-t.rotation}) scale(${scale})`}>
      <tspan ref={name} x="0" y="-3">
        {t.name}
      </tspan>
      <tspan ref={guests} x="0" y="19">
        {t.shape.startsWith('sofa-') ? 'Sofa' : `${t.chairs.length} guests`}
      </tspan>
    </text>
  );
}
function Num({
  label,
  value,
  onChange,
  min = -5000,
  max = 5000,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const formatted = String(Math.round(value * 10) / 10);
  const [draft, setDraft] = useState(formatted);
  useEffect(() => setDraft(formatted), [formatted]);
  const commitValue = () => {
    const parsed = draft.trim() === '' ? value : Number(draft);
    const next = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : value;
    setDraft(String(Math.round(next * 10) / 10));
    if (next !== value) onChange(next);
  };
  return (
    <label className="field">
      {label}
      <input
        type="number"
        value={draft}
        min={min}
        max={max}
        step="any"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitValue}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

export default function App() {
  const [doc, setDoc] = useState<Document>(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      return raw
        ? validate(JSON.parse(raw))
        : { schemaVersion: 1, units: 'cm', halls: [], tables: [] };
    } catch {
      return { schemaVersion: 1, units: 'cm', halls: [], tables: [] };
    }
  });
  const [hallId, setHallId] = useState(doc.halls[0]?.id ?? ''),
    [selected, setSelected] = useState<string | null>(null),
    [chairId, setChairId] = useState<string | null>(null),
    [pick, setPick] = useState(''),
    [zoom, setZoom] = useState(1),
    [snap, setSnap] = useState(true),
    [tab, setTab] = useState('relations'),
    [status, setStatus] = useState('Local storage enabled');
  const [checkedTables, setCheckedTables] = useState<string[]>([]),
    [pickerOpen, setPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false),
    [createPrefix, setCreatePrefix] = useState('Table'),
    [createCount, setCreateCount] = useState('1'),
    [createShape, setCreateShape] = useState<Shape>('rectangle');
  const [is3D, setIs3D] = useState(false);
  const [creatorSofa, setCreatorSofa] = useState(false);
  const [rename, setRename] = useState<{ id: string; name: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [saveNotice, setSaveNotice] = useState<{ message: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (!saveNotice) return;
    const timer = window.setTimeout(() => setSaveNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [saveNotice]);
  const [hint, setHint] = useState<Hint>(null);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setFullscreen((v) => !v);
    }
  };
  const [panel, setPanel] = useState<'hall' | 'tables' | 'selection' | null>(null),
    [showData, setShowData] = useState(false),
    [pan, setPan] = useState({ x: 0, y: 0 });
  const panDrag = useRef<{
    x: number;
    y: number;
    px: number;
    py: number;
    sx: number;
    sy: number;
  } | null>(null);
  const past = useRef<Document[]>([]),
    future = useRef<Document[]>([]),
    [history, setHistory] = useState(0);
  const workArea = useRef<HTMLElement>(null),
    svg = useRef<SVGSVGElement>(null),
    file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const area = workArea.current;
    if (!area) return;
    const isCanvas = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest('.canvas-scroll'));
    const wheel = (e: WheelEvent) => {
      if (isCanvas(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        const speed = e.ctrlKey ? 0.012 : 0.0015;
        setZoom((z) =>
          Math.max(
            0.4,
            Math.min(4, z * Math.exp(-Math.max(-200, Math.min(200, e.deltaY)) * speed)),
          ),
        );
      } else if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };
    let lastScale = 1;
    const gestureStart = (e: Event) => {
      e.preventDefault();
      lastScale = 1;
    };
    const gestureChange = (e: Event) => {
      e.preventDefault();
      const scale = (e as Event & { scale: number }).scale;
      if (isCanvas(e.target) && Number.isFinite(scale) && scale > 0) {
        setZoom((z) => Math.max(0.4, Math.min(4, (z * scale) / lastScale)));
        lastScale = scale;
      }
    };
    area.addEventListener('wheel', wheel, { passive: false });
    area.addEventListener('gesturestart', gestureStart, { passive: false });
    area.addEventListener('gesturechange', gestureChange, { passive: false });
    return () => {
      area.removeEventListener('wheel', wheel);
      area.removeEventListener('gesturestart', gestureStart);
      area.removeEventListener('gesturechange', gestureChange);
    };
  }, []);
  const hallDrag = useRef<{
    before: Document;
    hall: Hall;
    x: number;
    y: number;
    sx: number;
    sy: number;
  } | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    t: Table;
    c?: string;
    before: Document;
    mode: 'move' | 'resize' | 'rotate';
  } | null>(null);
  const hall: Hall = doc.halls.find((h) => h.id === hallId) ??
      doc.halls[0] ?? {
        id: '',
        name: 'No hall selected',
        shape: 'rectangle',
        width: 1200,
        height: 800,
      },
    tables = useMemo(() => doc.tables.filter((t) => t.hallId === hall.id), [doc.tables, hall.id]),
    placed = tables.filter((t) => t.placed),
    table = placed.find((t) => t.id === selected),
    chair = table?.chairs.find((c) => c.id === chairId);
  const commit = (next: Document) => {
    past.current = [...past.current.slice(-79), doc];
    future.current = [];
    setDoc(next);
    setHistory(history + 1);
  };
  const update = (patch: Partial<Table>) => {
    if (table)
      commit({
        ...doc,
        tables: doc.tables.map((t) => {
          if (t.id !== table.id) return t;
          const next = { ...t, ...patch };
          if (patch.width !== undefined || patch.height !== undefined || patch.shape !== undefined)
            next.chairs = arrange(next, next.chairs.length, next.chairs);
          return fitTablesToHall([next], hall)[0];
        }),
      });
  };
  const updateHall = (patch: Partial<Hall>) => {
    const next = { ...hall, ...patch };
    commit({
      ...doc,
      halls: doc.halls.map((h) => (h.id === hall.id ? next : h)),
      tables: fitTablesToHall(doc.tables, next),
    });
  };
  const undo = () => {
    const p = past.current.pop();
    if (p) {
      future.current.push(doc);
      setDoc(p);
      setHistory((v) => v + 1);
      const active = p.tables.find((t) => t.id === selected && t.placed);
      if (!active) {
        setSelected(null);
        setChairId(null);
      } else if (!active.chairs.some((c) => c.id === chairId)) setChairId(null);
    }
  };
  const redo = () => {
    const p = future.current.pop();
    if (p) {
      past.current.push(doc);
      setDoc(p);
      setHistory((v) => v + 1);
      const active = p.tables.find((t) => t.id === selected && t.placed);
      if (!active) {
        setSelected(null);
        setChairId(null);
      } else if (!active.chairs.some((c) => c.id === chairId)) setChairId(null);
    }
  };
  const remove = () => {
    if (!table) return;
    if (chair) update({ chairs: table.chairs.filter((c) => c.id !== chair.id) });
    else {
      update({ placed: false });
      setSelected(null);
    }
    setChairId(null);
  };
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(doc));
      setStatus('All changes saved locally');
    } catch {
      setStatus('Storage unavailable — export your JSON');
    }
  }, [doc]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,select,textarea')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        remove();
      }
      if (e.key === 'Escape') {
        setSelected(null);
        setChairId(null);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  const lastFurnitureTap = useRef<{ id: string; time: number; x: number; y: number } | null>(null);
  const point = (e: PE) => {
    const p = new DOMPoint(e.clientX, e.clientY);
    return p.matrixTransform(svg.current!.getScreenCTM()!.inverse());
  };
  const start = (e: PE, t: Table, c?: string, mode: 'move' | 'resize' | 'rotate' = 'move') => {
    e.stopPropagation();
    if (e.button !== 0) return;
    e.preventDefault();
    window.getSelection()?.removeAllRanges();
    setHint(null);
    const p = point(e);
    setSelected(t.id);
    setChairId(c ?? null);
    setPanel('selection');
    if (!c && mode === 'move') {
      const previous = lastFurnitureTap.current,
        now = performance.now();
      if (
        previous?.id === t.id &&
        now - previous.time < 400 &&
        Math.hypot(e.clientX - previous.x, e.clientY - previous.y) < 6
      ) {
        lastFurnitureTap.current = null;
        setRename({ id: t.id, name: t.name });
        return;
      }
      lastFurnitureTap.current = { id: t.id, time: now, x: e.clientX, y: e.clientY };
    }
    drag.current = { x: p.x, y: p.y, t: structuredClone(t), c, before: doc, mode };
    svg.current!.setPointerCapture(e.pointerId);
  };
  const startHallResize = (e: PE) => {
    e.preventDefault();
    e.stopPropagation();
    setHint(null);
    const matrix = svg.current!.getScreenCTM()!.inverse();
    hallDrag.current = {
      before: doc,
      hall: { ...hall },
      x: e.clientX,
      y: e.clientY,
      sx: matrix.a,
      sy: matrix.d,
    };
    svg.current!.setPointerCapture(e.pointerId);
  };
  const move = (e: PE) => {
    if (hallDrag.current) {
      const d = hallDrag.current,
        round = (v: number) =>
          Math.max(300, Math.min(3000, Math.round(v / (snap ? 10 : 1)) * (snap ? 10 : 1)));
      const resized: Hall = {
        ...d.hall,
        shape: 'custom',
        width: round(d.hall.width + (e.clientX - d.x) * d.sx),
        height: round(d.hall.height + (e.clientY - d.y) * d.sy),
      };
      setDoc({
        ...d.before,
        halls: d.before.halls.map((h) => (h.id === d.hall.id ? resized : h)),
        tables: fitTablesToHall(d.before.tables, resized),
      });
      return;
    }
    if (panDrag.current) {
      const d = panDrag.current;
      setPan({ x: d.px + (e.clientX - d.x) * d.sx, y: d.py + (e.clientY - d.y) * d.sy });
      return;
    }
    const d = drag.current;
    if (!d) return;
    const p = point(e),
      dx = p.x - d.x,
      dy = p.y - d.y,
      round = (n: number) => (snap ? Math.round(n / 10) * 10 : Math.round(n));
    let t = { ...d.t };
    const a = (-t.rotation * Math.PI) / 180;
    const lx = dx * Math.cos(a) - dy * Math.sin(a),
      ly = dx * Math.sin(a) + dy * Math.cos(a);
    const chairBefore = d.c ? d.t.chairs.find((c) => c.id === d.c) : undefined;
    if (d.mode === 'rotate') {
      const ta = (t.rotation * Math.PI) / 180;
      const cx =
          t.x + (chairBefore ? chairBefore.x * Math.cos(ta) - chairBefore.y * Math.sin(ta) : 0),
        cy = t.y + (chairBefore ? chairBefore.x * Math.sin(ta) + chairBefore.y * Math.cos(ta) : 0);
      let delta =
        ((Math.atan2(p.y - cy, p.x - cx) - Math.atan2(d.y - cy, d.x - cx)) * 180) / Math.PI;
      const base = chairBefore?.rotation ?? d.t.rotation;
      let rotation = ((base + delta + 540) % 360) - 180;
      if (snap) rotation = Math.round(rotation / 15) * 15;
      if (chairBefore) t.chairs = t.chairs.map((c) => (c.id === d.c ? { ...c, rotation } : c));
      else t.rotation = rotation;
    } else if (d.mode === 'resize') {
      if (chairBefore) {
        const ca = (-chairBefore.rotation * Math.PI) / 180,
          clx = lx * Math.cos(ca) - ly * Math.sin(ca),
          cly = lx * Math.sin(ca) + ly * Math.cos(ca);
        t.chairs = t.chairs.map((c) =>
          c.id === d.c
            ? {
                ...c,
                width: Math.max(20, Math.min(100, round((c.width ?? 34) + clx * 2))),
                height: Math.max(20, Math.min(100, round((c.height ?? 34) + cly * 2))),
              }
            : c,
        );
      } else {
        t.width = Math.max(40, Math.min(400, round(d.t.width + lx * 2)));
        t.height =
          t.shape === 'circle' || t.shape === 'square'
            ? t.width
            : Math.max(40, Math.min(400, round(d.t.height + ly * 2)));
        t.chairs = arrange(t, t.chairs.length, t.chairs);
      }
    } else if (d.c) {
      t.chairs = t.chairs.map((c) =>
        c.id === d.c ? { ...c, x: round(c.x + lx), y: round(c.y + ly) } : c,
      );
    } else {
      t.x = Math.max(0, Math.min(hall.width, round(d.t.x + dx)));
      t.y = Math.max(0, Math.min(hall.height, round(d.t.y + dy)));
    }
    if (!d.c) t = fitTablesToHall([t], hall)[0];
    setDoc({ ...d.before, tables: d.before.tables.map((v) => (v.id === t.id ? t : v)) });
  };
  const end = () => {
    panDrag.current = null;
    if (hallDrag.current) {
      const d = hallDrag.current;
      hallDrag.current = null;
      if (JSON.stringify(d.before) !== JSON.stringify(doc)) {
        past.current = [...past.current.slice(-79), d.before];
        future.current = [];
        setHistory((v) => v + 1);
      }
      return;
    }
    const d = drag.current;
    if (d) {
      if (JSON.stringify(d.before) !== JSON.stringify(doc)) {
        past.current = [...past.current.slice(-79), d.before];
        future.current = [];
        setHistory((v) => v + 1);
      }
      drag.current = null;
    }
  };
  const catalogPick = tables.find(
    (t) => t.id === (pick || tables.find((v) => !v.placed)?.id || tables[0]?.id),
  );
  const bulkTables = tables.filter((t) => !t.placed && checkedTables.includes(t.id));
  const add = () => {
    if (bulkTables.length) {
      const ids = new Set(bulkTables.map((t) => t.id)),
        columns = Math.max(1, Math.floor((hall.width - 160) / 240)),
        start = placed.length;
      let index = 0;
      const next = {
        ...doc,
        tables: doc.tables.map((t) => {
          if (!ids.has(t.id)) return t;
          const slot = start + index++;
          return {
            ...t,
            placed: true,
            x:
              bulkTables.length === 1
                ? hall.width / 2
                : Math.min(hall.width - 80, 120 + (slot % columns) * 240),
            y:
              bulkTables.length === 1
                ? hall.height / 2
                : Math.min(hall.height - 80, 120 + Math.floor(slot / columns) * 190),
          };
        }),
      };
      commit(next);
      setCheckedTables([]);
      setPickerOpen(false);
      setPick('');
      setChairId(null);
      if (bulkTables.length === 1) {
        setSelected(bulkTables[0].id);
        setPanel('selection');
      } else {
        setSelected(null);
        setStatus(`${bulkTables.length} tables added. Select a table on the plan to edit it.`);
      }
    } else if (catalogPick?.placed) {
      setSelected(catalogPick.id);
      setChairId(null);
      setPanel('selection');
      setPickerOpen(false);
    }
  };
  const duplicateTable = (source: Table) => {
    if (doc.tables.length >= 2000) {
      setSaveNotice({ message: 'The inventory limit is 2000 tables.', ok: false });
      return;
    }
    let index = 1,
      name = `${source.name} copy`;
    const names = new Set(tables.map((t) => t.name));
    while (names.has(name)) name = `${source.name} copy ${++index}`;
    const clone: Table = {
      ...structuredClone(source),
      id: uid(),
      name,
      x: source.x + 40,
      y: source.y + 40,
      placed: true,
      chairs: source.chairs.map((c) => ({ ...c, id: uid() })),
    };
    const fitted = fitTablesToHall([clone], hall)[0];
    commit({ ...doc, tables: [...doc.tables, fitted] });
    setSelected(fitted.id);
    setChairId(null);
    setPanel('selection');
    setHint(null);
    setStatus(`${source.name} duplicated with ${source.chairs.length} chairs.`);
  };
  const addChair = (t: Table) => {
    if (t.shape.startsWith('sofa-') || t.chairs.length >= 30) return;
    commit({
      ...doc,
      tables: doc.tables.map((v) =>
        v.id === t.id ? { ...v, chairs: arrange(v, v.chairs.length + 1, v.chairs) } : v,
      ),
    });
  };
  const resetAll = () => {
    const empty: Document = { schemaVersion: 1, units: 'cm', halls: [], tables: [] };
    localStorage.removeItem('floorplan-last-save-v1');
    localStorage.setItem(STORAGE, JSON.stringify(empty));
    past.current = [];
    future.current = [];
    setDoc(empty);
    setHallId('');
    setSelected(null);
    setChairId(null);
    setPick('');
    setCheckedTables([]);
    setPickerOpen(false);
    setPanel(null);
    setShowData(false);
    setCreateOpen(false);
    setCreatePrefix('Table');
    setCreateCount('1');
    setCreateShape('rectangle');
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setSnap(true);
    setSaveNotice(null);
    setHint(null);
    setHistory((v) => v + 1);
    setResetOpen(false);
    setIs3D(false);
  };
  const saveLayout = () => {
    try {
      const serialized = JSON.stringify(doc);
      localStorage.setItem(STORAGE, serialized);
      localStorage.setItem(
        'floorplan-last-save-v1',
        JSON.stringify({ document: doc, savedAt: new Date().toISOString() }),
      );
      setCreatePrefix(creatorSofa ? 'Sofa' : 'Table');
      setCreateCount('1');
      setCreateShape(creatorSofa ? 'sofa-straight' : 'rectangle');
      setCreateOpen(false);
      setStatus('Layout saved to this browser');
      setSaveNotice({ message: 'Layout saved successfully to this browser.', ok: true });
    } catch {
      setStatus('Save failed — export your JSON');
      setSaveNotice({ message: 'Could not save. Export JSON to keep a backup.', ok: false });
    }
  };
  const exportJSON = () => {
    const a = document.createElement('a');
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }),
    );
    a.href = url;
    a.download = 'floorplan-layout.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  const importJSON = async (f: File) => {
    try {
      if (f.size > 2e6) throw Error('File exceeds 2 MB.');
      const next = validate(JSON.parse(await f.text()));
      commit(next);
      setHallId(next.halls[0]?.id ?? '');
      setSelected(null);
      setChairId(null);
      setPick('');
      setCheckedTables([]);
      setPickerOpen(false);
      setStatus('JSON imported successfully');
    } catch (e) {
      setStatus(`Import failed: ${(e as Error).message}`);
    }
    if (file.current) file.current.value = '';
  };
  const createHall = () => {
    const h: Hall = {
      id: uid(),
      name: `Hall ${doc.halls.length + 1}`,
      shape: 'rectangle',
      width: 1200,
      height: 800,
    };
    commit({ ...doc, halls: [...doc.halls, h] });
    setHallId(h.id);
    setSelected(null);
    setChairId(null);
    setPick('');
    setCheckedTables([]);
    setPickerOpen(false);
    setPanel('hall');
    setPan({ x: 0, y: 0 });
  };
  const openFurnitureCreator = (sofa: boolean) => {
    setPanel('tables');
    setCreatorSofa(sofa);
    setCreateOpen(true);
    setPickerOpen(false);
    setCreatePrefix(sofa ? 'Sofa' : 'Table');
    setCreateCount('1');
    setCreateShape(sofa ? 'sofa-straight' : 'rectangle');
  };
  const quickAdd = (shape: Shape) => {
    if (!hall.id || doc.tables.length >= 2000) return;
    const sofa = shape.startsWith('sofa-'),
      prefix = sofa ? 'Sofa' : 'Table';
    let index = 1;
    const names = new Set(tables.map((t) => t.name));
    while (names.has(`${prefix} ${String(index).padStart(2, '0')}`)) index++;
    const round = shape === 'circle' || shape === 'square',
      width = sofa ? 180 : round ? 100 : 160,
      height =
        shape === 'sofa-circle'
          ? 180
          : shape === 'sofa-corner'
            ? 160
            : shape === 'sofa-semicircle'
              ? 110
              : round
                ? 100
                : 85;
    const t: Table = {
      id: uid(),
      hallId: hall.id,
      name: `${prefix} ${String(index).padStart(2, '0')}`,
      shape,
      width,
      height,
      x: hall.width / 2 + (placed.length % 3) * 30,
      y: hall.height / 2 + (placed.length % 3) * 30,
      rotation: 0,
      placed: true,
      chairs: [],
    };
    const fitted = fitTablesToHall([t], hall)[0];
    commit({ ...doc, tables: [...doc.tables, fitted] });
    setSelected(t.id);
    setChairId(null);
    setPanel(null);
    setRename(null);
  };
  const finishRename = () => {
    if (rename?.name.trim())
      commit({
        ...doc,
        tables: doc.tables.map((t) =>
          t.id === rename.id ? { ...t, name: rename.name.trim() } : t,
        ),
      });
    setRename(null);
  };
  const createTable = (place = false) => {
    const count = Number(createCount),
      prefix = createPrefix.trim();
    if (
      !hall.id ||
      !prefix ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 100 ||
      doc.tables.length + count > 2000
    )
      return;
    let number = 1;
    const names = new Set(tables.map((t) => t.name));
    const created: Table[] = Array.from({ length: count }, (_, i) => {
      let name;
      do {
        name = `${prefix} ${String(number++).padStart(2, '0')}`;
      } while (names.has(name));
      names.add(name);
      const round = createShape === 'square' || createShape === 'circle';
      return {
        id: uid(),
        hallId: hall.id,
        name,
        shape: createShape,
        width: round ? 100 : createShape.startsWith('sofa-') ? 180 : 160,
        height: round
          ? 100
          : createShape === 'sofa-circle'
            ? 180
            : createShape === 'sofa-corner'
              ? 160
              : createShape === 'sofa-semicircle'
                ? 110
                : 85,
        x:
          count === 1
            ? hall.width / 2
            : Math.min(
                hall.width - 80,
                120 + (i % Math.max(1, Math.floor((hall.width - 160) / 240))) * 240,
              ),
        y:
          count === 1
            ? hall.height / 2
            : Math.min(
                hall.height - 80,
                120 + Math.floor(i / Math.max(1, Math.floor((hall.width - 160) / 240))) * 190,
              ),
        rotation: 0,
        placed: place,
        chairs: [],
      };
    });
    commit({ ...doc, tables: [...doc.tables, ...fitTablesToHall(created, hall)] });
    setPick(place ? '' : created[0].id);
    setCheckedTables((ids) => (place ? [] : [...new Set([...ids, ...created.map((t) => t.id)])]));
    if (place && created.length === 1) {
      setSelected(created[0].id);
      setChairId(null);
      setPanel('selection');
    }
    setPickerOpen(false);
    setCreateOpen(false);
    setCreatePrefix(creatorSofa ? 'Sofa' : 'Table');
    setCreateCount('1');
    setCreateShape(creatorSofa ? 'sofa-straight' : 'rectangle');
    setStatus(
      place
        ? `${count} tables created and added to the plan.`
        : `${count} tables created. Ready to add to the plan.`,
    );
  };
  const toggleSnap = (enabled: boolean) => {
    setSnap(enabled);
    setHint(null);
    if (enabled) {
      const grid = (v: number) => Math.round(v / 10) * 10;
      const next = {
        ...doc,
        tables: doc.tables.map((t) =>
          t.hallId === hall.id && t.placed
            ? {
                ...t,
                x: grid(t.x),
                y: grid(t.y),
                chairs: t.chairs.map((c) => ({ ...c, x: grid(c.x), y: grid(c.y) })),
              }
            : t,
        ),
      };
      if (JSON.stringify(next) !== JSON.stringify(doc)) commit(next);
    }
  };
  const viewHall = hallDrag.current?.hall ?? hall;
  const seats = placed.reduce((n, t) => n + t.chairs.length, 0);
  return (
    <div
      onPointerOverCapture={(e) => {
        const target = (e.target as Element).closest('[disabled][data-disabled-reason]');
        if (target)
          setHint({
            text: target.getAttribute('data-disabled-reason')!,
            x: e.clientX,
            y: e.clientY,
          });
      }}
      onPointerOutCapture={(e) => {
        if ((e.target as Element).closest('[disabled][data-disabled-reason]')) setHint(null);
      }}
      onDragStart={(e) => e.preventDefault()}
      className={`app ${fullscreen ? 'fullscreen-mode' : 'page-mode'} ${is3D ? 'three-mode' : ''}`}
    >
      {resetOpen && (
        <div className="reset-backdrop">
          <div
            className="reset-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
          >
            <h2 id="reset-title">Reset everything?</h2>
            <p>
              All halls, tables, chairs and locally saved layouts will be deleted. This cannot be
              undone.
            </p>
            <div>
              <button onClick={() => setResetOpen(false)}>Cancel</button>
              <button className="danger" onClick={resetAll}>
                Reset everything
              </button>
            </div>
          </div>
        </div>
      )}
      {saveNotice && (
        <div className={`save-notice ${saveNotice.ok ? 'success' : 'error'}`} role="status">
          {saveNotice.ok ? '✓' : '!'} {saveNotice.message}
        </div>
      )}
      {hint && (
        <div
          role="tooltip"
          className="map-tooltip"
          style={{
            left: Math.max(10, Math.min(hint.x + 12, window.innerWidth - 265)),
            top: Math.min(hint.y + 22, window.innerHeight - 85),
          }}
        >
          {hint.text}
        </div>
      )}
      <aside className="rail">
        <button className="rail-active" title="Floor plan">
          <Icon name="layers" />
        </button>
      </aside>
      <div className="shell">
        <header>
          <div className="brand">
            Floorplan<small>RESTAURANT LAYOUT STUDIO</small>
          </div>
          <div className="header-right">
            <span className="project-badge">Layout studio</span>
            <span className="avatar">MN</span>
          </div>
        </header>
        <main ref={workArea}>
          <div className="page-heading">
            <div>
              <div className="breadcrumb">
                Restaurant <span>/</span> Space management
              </div>
              <h1>
                Floor plan <span className="beta">STUDIO</span>
              </h1>
              <p>A place for every table. A better experience for every guest.</p>
            </div>
            <div className="actions">
              <button title="Reset all" onClick={() => setResetOpen(true)}>
                <Icon name="trash" />
                Reset
              </button>
              <button
                title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                onClick={() => void toggleFullscreen()}
              >
                <Icon name="fit" />
                {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              </button>
              <button onClick={() => setShowData((v) => !v)}>
                <Icon name="grid" />
                Data
              </button>
              <button onClick={() => file.current?.click()}>
                <Icon name="upload" />
                Import JSON
              </button>
              <button onClick={exportJSON}>
                <Icon name="download" />
                Export
              </button>
              <button className="primary" title="Save layout to this browser" onClick={saveLayout}>
                <Icon name="save" />
                {saveNotice?.ok ? 'Saved' : 'Save layout'}
              </button>
              <input
                ref={file}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => {
                  if (e.target.files?.[0]) void importJSON(e.target.files[0]);
                }}
              />
            </div>
          </div>
          <div className="workspace">
            <section className="editor">
              <div className="editor-top">
                <div className="hall-switch">
                  <Icon name="layers" />
                  <select
                    aria-label="Select hall"
                    value={hall.id}
                    onChange={(e) => {
                      setHallId(e.target.value);
                      setSelected(null);
                      setChairId(null);
                      setPick('');
                      setCheckedTables([]);
                      setPickerOpen(false);
                      setCreateOpen(false);
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                    }}
                  >
                    {doc.halls.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                  <button className="tool" title="Create hall" onClick={createHall}>
                    <Icon name="plus" />
                  </button>
                  <span className="dot" /> <span>{hall.id ? 'Active hall' : 'Start here'}</span>
                </div>
                <div className="stats">
                  <span>
                    <b>{placed.length}</b> tables
                  </span>
                  <span>
                    <b>{seats}</b> seats
                  </span>
                  <span>
                    <b>{(hall.width * hall.height) / 10000}</b> m²
                  </span>
                </div>
              </div>
              <div className="map-modes">
                <button
                  className={`view-toggle ${is3D ? 'active' : ''}`}
                  data-disabled-reason="Create a hall first."
                  disabled={!hall.id}
                  onClick={() => {
                    setIs3D((v) => !v);
                    setSelected(null);
                    setChairId(null);
                    setPanel(null);
                    setRename(null);
                    setHint(null);
                  }}
                >
                  {is3D ? '2D editor' : '3D view'}
                </button>
                <button
                  className={panel === 'hall' ? 'active' : ''}
                  onClick={() => setPanel(panel === 'hall' ? null : 'hall')}
                >
                  <Icon name="settings" />
                  Hall
                </button>
                <button
                  className={panel === 'tables' ? 'active' : ''}
                  data-disabled-reason="Create a hall first."
                  disabled={!hall.id}
                  aria-label="Tables"
                  onClick={() => openFurnitureCreator(false)}
                >
                  <Icon name="plus" />
                  Add table
                </button>
                <button
                  data-disabled-reason="Create a hall first."
                  disabled={!hall.id}
                  onClick={() => openFurnitureCreator(true)}
                >
                  <Icon name="plus" />
                  Add sofa
                </button>
                <label
                  className="snap snap-chip"
                  onPointerEnter={(e) =>
                    setHint({
                      text: 'Aligns tables and chairs to 10 cm steps. Turning on also aligns their current positions.',
                      x: e.clientX,
                      y: e.clientY,
                    })
                  }
                  onPointerLeave={() => setHint(null)}
                >
                  <input
                    type="checkbox"
                    checked={snap}
                    onChange={(e) => toggleSnap(e.target.checked)}
                  />
                  <Icon name="grid" />
                  <span>Snap to grid</span>
                </label>
              </div>
              <div className="toolbar">
                <div className="tool-group">
                  <button className="tool active" title="Selection tool">
                    <Icon name="cursor" />
                  </button>
                  <span className="divider" />
                  <button
                    className="tool"
                    title="Undo (⌘Z)"
                    data-disabled-reason="No changes to undo."
                    disabled={!past.current.length}
                    onClick={undo}
                  >
                    <Icon name="undo" />
                  </button>
                  <button
                    className="tool"
                    title="Redo (⌘⇧Z)"
                    data-disabled-reason="No changes to redo."
                    disabled={!future.current.length}
                    onClick={redo}
                  >
                    <Icon name="redo" />
                  </button>
                  <span className="divider" />
                  <button
                    className="tool"
                    title="Delete selection"
                    data-disabled-reason="Select a table or chair first."
                    disabled={!table}
                    onClick={remove}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
              {is3D && (
                <Suspense fallback={<div className="three-loading">Loading 3D view…</div>}>
                  <View3D hall={hall} tables={tables} />
                </Suspense>
              )}
              <div className="canvas-scroll">
                {!hall.id && (
                  <div className="onboarding">
                    <Icon name="layers" />
                    <h2>Your space. A fresh start.</h2>
                    <p>Create your first hall, then add tables and chairs.</p>
                    <button className="primary" onClick={createHall}>
                      <Icon name="plus" />
                      Create your first hall
                    </button>
                  </div>
                )}
                <svg
                  ref={svg}
                  className={`canvas ${!hall.id ? 'canvas-empty' : ''}`}
                  style={{ width: '100%', height: '100%' }}
                  viewBox={`${viewHall.width / 2 - (viewHall.width + 220) / zoom / 2 - pan.x} ${viewHall.height / 2 - (viewHall.height + 220) / zoom / 2 - pan.y} ${(viewHall.width + 220) / zoom} ${(viewHall.height + 220) / zoom}`}
                  onPointerMove={move}
                  onPointerUp={end}
                  onPointerCancel={end}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.preventDefault();
                    window.getSelection()?.removeAllRanges();
                    setHint(null);
                    setSelected(null);
                    setChairId(null);
                    setPanel(null);
                    setRename(null);
                    const matrix = svg.current!.getScreenCTM()!.inverse();
                    panDrag.current = {
                      x: e.clientX,
                      y: e.clientY,
                      px: pan.x,
                      py: pan.y,
                      sx: matrix.a,
                      sy: matrix.d,
                    };
                    svg.current!.setPointerCapture(e.pointerId);
                  }}
                  role="application"
                  aria-label="Floor plan: drag tables and chairs"
                >
                  <defs>
                    <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                      <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#dae3e0" strokeWidth=".7" />
                    </pattern>
                    <pattern id="biggrid" width="100" height="100" patternUnits="userSpaceOnUse">
                      <rect width="100" height="100" fill="url(#grid)" />
                      <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#c9d6d1" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect
                    x="-110"
                    y="-110"
                    width={hall.width + 220}
                    height={hall.height + 220}
                    fill="#f4f7f5"
                    pointerEvents="none"
                  />
                  <text className="dimension" x={hall.width / 2} y="-50" textAnchor="middle">
                    {(hall.width / 100).toFixed(1)} m
                  </text>
                  <text
                    className="dimension"
                    transform={`translate(-55 ${hall.height / 2}) rotate(-90)`}
                    textAnchor="middle"
                  >
                    {(hall.height / 100).toFixed(1)} m
                  </text>
                  {hall.shape === 'circle' ? (
                    <ellipse
                      cx={hall.width / 2}
                      cy={hall.height / 2}
                      rx={hall.width / 2}
                      ry={hall.height / 2}
                      className="room"
                    />
                  ) : (
                    <rect width={hall.width} height={hall.height} rx="8" className="room" />
                  )}

                  {snap && table && drag.current?.mode === 'move' && !chair && (
                    <g className="snap-guides" pointerEvents="none">
                      <line x1={table.x} y1="0" x2={table.x} y2={hall.height} />
                      <line x1="0" y1={table.y} x2={hall.width} y2={table.y} />
                    </g>
                  )}
                  {placed.map((t) => (
                    <g key={t.id} transform={`translate(${t.x} ${t.y}) rotate(${t.rotation})`}>
                      {t.chairs.map((c) => (
                        <g
                          key={c.id}
                          data-chair-id={c.id}
                          className={`chair ${chairId === c.id ? 'chosen' : ''}`}
                          transform={`translate(${c.x} ${c.y}) rotate(${c.rotation})`}
                          onPointerDown={(e) => start(e, t, c.id)}
                        >
                          <g transform={`scale(${(c.width ?? 34) / 34} ${(c.height ?? 34) / 34})`}>
                            <rect x="-17" y="-17" width="34" height="34" rx="9" />
                            <path d="M -19 -6 L -19 -15 Q -19 -23 -10 -23 L 10 -23 Q 19 -23 19 -15 L 19 -6" />
                          </g>
                        </g>
                      ))}
                      <g
                        data-table-id={t.id}
                        className={`furniture ${selected === t.id ? 'selected' : ''}`}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setSelected(t.id);
                          setChairId(null);
                          setRename({ id: t.id, name: t.name });
                        }}
                        onPointerDown={(e) => start(e, t)}
                      >
                        {t.shape.startsWith('sofa-') ? (
                          <SofaGeometry table={t} />
                        ) : t.shape === 'circle' ? (
                          <ellipse rx={t.width / 2} ry={t.height / 2} />
                        ) : t.shape === 'organic' ? (
                          <path
                            transform={`scale(${t.width / 100} ${t.height / 100})`}
                            d="M-47,-23 C-55,-55 -5,-58 13,-39 C44,-60 62,-20 44,5 C65,39 20,59 -2,39 C-36,60 -65,20 -44,0 C-60,-10 -52,-18 -47,-23 Z"
                          />
                        ) : (
                          <rect
                            x={-t.width / 2}
                            y={-t.height / 2}
                            width={t.width}
                            height={t.height}
                            rx="7"
                          />
                        )}
                        <TableLabel table={t} />
                      </g>
                    </g>
                  ))}
                  <text
                    className="entry"
                    x={hall.width / 2}
                    y={hall.height + 55}
                    textAnchor="middle"
                  >
                    ENTRANCE ↑
                  </text>

                  <g className="interaction-overlay" data-controls-layer="top">
                    {panel === 'hall' && hall.id && (
                      <TransformHandle
                        id="hall-resize"
                        x={hall.width}
                        y={hall.height}
                        kind="resize"
                        onDrag={startHallResize}
                        onHint={setHint}
                      />
                    )}
                    {table &&
                      (() => {
                        const t = table;
                        return (
                          <g transform={`translate(${t.x} ${t.y}) rotate(${t.rotation})`}>
                            {chair ? (
                              (() => {
                                const c = chair;
                                return (
                                  <g transform={`translate(${c.x} ${c.y}) rotate(${c.rotation})`}>
                                    {' '}
                                    {
                                      <g className="transform-controls">
                                        <rect
                                          className="selection-box"
                                          x={-(c.width ?? 34) / 2 - 6}
                                          y={-(c.height ?? 34) / 2 - 6}
                                          width={(c.width ?? 34) + 12}
                                          height={(c.height ?? 34) + 12}
                                        />
                                        <TransformHandle
                                          id="chair-resize"
                                          rotation={t.rotation + c.rotation}
                                          x={(c.width ?? 34) / 2 + 7}
                                          y={(c.height ?? 34) / 2 + 7}
                                          kind="resize"
                                          onDrag={(e) => start(e, t, c.id, 'resize')}
                                          onHint={setHint}
                                        />
                                        <line
                                          className="rotation-stem"
                                          x1="0"
                                          y1={-(c.height ?? 34) / 2 - 6}
                                          x2="0"
                                          y2={-(c.height ?? 34) / 2 - 32}
                                        />
                                        <TransformHandle
                                          id="chair-delete"
                                          rotation={t.rotation + c.rotation}
                                          x={(c.width ?? 34) / 2 + 35}
                                          y={0}
                                          kind="trash"
                                          label="Delete chair"
                                          onDrag={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setHint(null);
                                            remove();
                                          }}
                                          onHint={setHint}
                                        />
                                        <TransformHandle
                                          id="chair-rotate"
                                          rotation={t.rotation + c.rotation}
                                          x={0}
                                          y={-(c.height ?? 34) / 2 - 42}
                                          kind="rotate"
                                          onDrag={(e) => start(e, t, c.id, 'rotate')}
                                          onHint={setHint}
                                        />
                                      </g>
                                    }
                                  </g>
                                );
                              })()
                            ) : (
                              <>
                                {' '}
                                {(() => {
                                  const actions = actionHandlePositions(t),
                                    resize = resizeHandlePosition(t);
                                  return (
                                    <>
                                      <rect
                                        className="selection-box"
                                        x={-t.width / 2 - 8}
                                        y={-t.height / 2 - 8}
                                        width={t.width + 16}
                                        height={t.height + 16}
                                      />
                                      <TransformHandle
                                        id="table-resize"
                                        rotation={t.rotation}
                                        x={resize.x}
                                        y={resize.y}
                                        kind="resize"
                                        onDrag={(e) => start(e, t, undefined, 'resize')}
                                        onHint={setHint}
                                      />
                                      <line
                                        className="rotation-stem"
                                        x1="0"
                                        y1={actions.rotate.y + 12}
                                        x2="0"
                                        y2={actions.rotate.y}
                                      />
                                      {!t.shape.startsWith('sofa-') && t.chairs.length < 30 && (
                                        <TransformHandle
                                          id="table-add-chair"
                                          rotation={t.rotation}
                                          x={actions.add.x}
                                          y={actions.add.y}
                                          kind="plus"
                                          onDrag={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setHint(null);
                                            addChair(t);
                                          }}
                                          onHint={setHint}
                                        />
                                      )}
                                      <TransformHandle
                                        id="table-delete"
                                        rotation={t.rotation}
                                        x={actions.trash.x}
                                        y={actions.trash.y}
                                        kind="trash"
                                        label={
                                          t.shape.startsWith('sofa-')
                                            ? 'Remove sofa from plan'
                                            : 'Remove table and chairs from plan'
                                        }
                                        onDrag={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setHint(null);
                                          remove();
                                        }}
                                        onHint={setHint}
                                      />
                                      <TransformHandle
                                        id="table-copy"
                                        rotation={t.rotation}
                                        x={actions.copy.x}
                                        y={actions.copy.y}
                                        kind="copy"
                                        label={
                                          t.shape.startsWith('sofa-')
                                            ? 'Duplicate sofa'
                                            : 'Duplicate table with chairs'
                                        }
                                        onDrag={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          duplicateTable(t);
                                        }}
                                        onHint={setHint}
                                      />
                                      <TransformHandle
                                        id="table-rotate"
                                        rotation={t.rotation}
                                        x={0}
                                        y={actions.rotate.y}
                                        kind="rotate"
                                        onDrag={(e) => start(e, t, undefined, 'rotate')}
                                        onHint={setHint}
                                      />
                                    </>
                                  );
                                })()}
                              </>
                            )}
                          </g>
                        );
                      })()}
                    {rename &&
                      placed.find((t) => t.id === rename.id) &&
                      (() => {
                        const t = placed.find((t) => t.id === rename.id)!;
                        return (
                          <foreignObject
                            transform={`translate(${t.x} ${t.y})`}
                            x="-85"
                            y="-19"
                            width="170"
                            height="40"
                          >
                            <input
                              className="inline-furniture-name"
                              aria-label="Furniture name"
                              autoFocus
                              value={rename.name}
                              maxLength={80}
                              onFocus={(e) => e.target.select()}
                              onPointerDown={(e) => e.stopPropagation()}
                              onChange={(e) => setRename({ ...rename, name: e.target.value })}
                              onBlur={finishRename}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.currentTarget.blur();
                                }
                                if (e.key === 'Escape') setRename(null);
                              }}
                            />
                          </foreignObject>
                        );
                      })()}
                  </g>
                </svg>
                <div className="canvas-label">
                  <span className="dot" /> {hall.name} <span>Top view</span>
                </div>
              </div>
              <div className="canvas-footer">
                <span>
                  <Icon name="cursor" />
                  Drag to pan <span className="muted">· Scroll to zoom</span>
                </span>
                <div className="zoom">
                  <button title="Zoom out" onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}>
                    <Icon name="zoom-out" />
                  </button>
                  <span>{Math.round(zoom * 100)}%</span>
                  <button title="Zoom in" onClick={() => setZoom((z) => Math.min(4, z + 0.2))}>
                    <Icon name="zoom-in" />
                  </button>
                  <button
                    title="Fit to view"
                    onClick={() => {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                    }}
                  >
                    <Icon name="fit" />
                  </button>
                </div>
              </div>
            </section>
            {hall.id && panel === null && (
              <aside className="quick-library" aria-label="Quick furniture library">
                <h2>Add to plan</h2>
                <p>Click to add · double-click a name to edit</p>
                <div className="quick-library-grid">
                  {(
                    [
                      'rectangle',
                      'circle',
                      'sofa-straight',
                      'sofa-corner',
                      'sofa-circle',
                      'sofa-semicircle',
                    ] as Shape[]
                  ).map((shape) => (
                    <button
                      key={shape}
                      title={`Add ${labels[shape].toLowerCase()} directly`}
                      aria-label={`Quick add ${labels[shape].toLowerCase()}`}
                      onClick={() => quickAdd(shape)}
                    >
                      <svg viewBox="-110 -100 220 200" aria-hidden="true">
                        {shape.startsWith('sofa-') ? (
                          <SofaGeometry
                            table={
                              {
                                shape,
                                width: 160,
                                height:
                                  shape === 'sofa-circle'
                                    ? 160
                                    : shape === 'sofa-corner'
                                      ? 150
                                      : 90,
                              } as Table
                            }
                          />
                        ) : shape === 'circle' ? (
                          <circle className="library-table" r="55" />
                        ) : (
                          <rect
                            className="library-table"
                            x="-80"
                            y="-45"
                            width="160"
                            height="90"
                            rx="8"
                          />
                        )}
                      </svg>
                      <span>
                        {shape === 'rectangle'
                          ? 'Table'
                          : shape === 'circle'
                            ? 'Round table'
                            : labels[shape]}
                      </span>
                    </button>
                  ))}
                </div>
              </aside>
            )}
            <aside className={`inspector map-panel ${panel ? 'is-open' : ''}`}>
              <button className="close-panel" title="Close panel" onClick={() => setPanel(null)}>
                ×
              </button>
              <section hidden={panel !== 'hall'}>
                <div className="section-heading">
                  <h2>
                    <Icon name="settings" />
                    Hall settings
                  </h2>
                  <span>01</span>
                </div>
                <label className="field">
                  Hall name
                  <input
                    data-disabled-reason="Create a hall first."
                    disabled={!hall.id}
                    value={hall.id ? hall.name : ''}
                    placeholder="Create a hall to begin"
                    onChange={(e) => updateHall({ name: e.target.value })}
                  />
                </label>
                <label className="field">
                  Hall shape
                  <select
                    value={hall.shape}
                    onChange={(e) => {
                      const shape = e.target.value as Hall['shape'];
                      updateHall({
                        shape,
                        ...(shape === 'circle' || shape === 'square' ? { height: hall.width } : {}),
                      });
                    }}
                  >
                    <option value="rectangle">Rectangle</option>
                    <option value="square">Square</option>
                    <option value="circle">Circle</option>
                    <option value="custom">Custom dimensions</option>
                  </select>
                </label>
                <div className="two">
                  <Num
                    label="Width (cm)"
                    value={hall.width}
                    min={300}
                    max={3000}
                    onChange={(width) => updateHall({ width, shape: 'custom' })}
                  />
                  <Num
                    label="Length (cm)"
                    value={hall.height}
                    min={300}
                    max={3000}
                    onChange={(height) => updateHall({ height, shape: 'custom' })}
                  />
                </div>
                <div className="id-line">
                  Hall ID <code>{hall.id}</code>
                </div>
              </section>
              <section hidden={panel !== 'tables'}>
                <div className="section-heading">
                  <h2>
                    <Icon name="plus" />
                    {creatorSofa ? 'Add sofa' : 'Add table'}
                  </h2>
                  <span>02</span>
                </div>
                <button
                  className="subtle"
                  data-disabled-reason="Create a hall first."
                  disabled={!hall.id}
                  onClick={() => {
                    setCreateOpen(true);
                    setPickerOpen(false);
                  }}
                  aria-expanded={createOpen}
                >
                  <Icon name="plus" />
                  {creatorSofa ? 'Create sofa' : 'Create table'}
                </button>
                {createOpen && (
                  <form
                    className="create-table-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      createTable(
                        (e.nativeEvent as SubmitEvent).submitter?.getAttribute('data-place') ===
                          'true',
                      );
                    }}
                  >
                    <label className="field">
                      Name prefix
                      <input
                        autoFocus
                        value={createPrefix}
                        maxLength={50}
                        required
                        placeholder="e.g. VIP"
                        onChange={(e) => setCreatePrefix(e.target.value)}
                      />
                    </label>
                    <div className="two">
                      <label className="field">
                        Quantity
                        <input
                          type="number"
                          min="1"
                          max={Math.min(100, 2000 - doc.tables.length)}
                          step="1"
                          required
                          value={createCount}
                          onChange={(e) => setCreateCount(e.target.value)}
                        />
                      </label>
                      <label className="field">
                        Shape
                        <select
                          value={createShape}
                          onChange={(e) => setCreateShape(e.target.value as Shape)}
                        >
                          {Object.entries(labels).map(([v, label]) => (
                            <option key={v} value={v}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <p className="helper">
                      Names: {createPrefix.trim() || 'Table'} 01, 02, 03… Existing names are
                      skipped.
                    </p>
                    <div className="create-actions">
                      <button type="button" onClick={() => setCreateOpen(false)}>
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="primary"
                        data-disabled-reason={
                          !createPrefix.trim()
                            ? 'Enter a name prefix.'
                            : doc.tables.length + Number(createCount) > 2000
                              ? 'The inventory limit is 2000 tables.'
                              : 'Enter a whole quantity between 1 and 100.'
                        }
                        disabled={
                          !createPrefix.trim() ||
                          !Number.isInteger(Number(createCount)) ||
                          Number(createCount) < 1 ||
                          Number(createCount) > 100 ||
                          doc.tables.length + Number(createCount) > 2000
                        }
                      >
                        {creatorSofa ? 'Create sofas' : 'Create tables'}
                      </button>
                      <button
                        type="submit"
                        data-place="true"
                        className="primary"
                        disabled={
                          !createPrefix.trim() ||
                          !Number.isInteger(Number(createCount)) ||
                          Number(createCount) < 1 ||
                          Number(createCount) > 100 ||
                          doc.tables.length + Number(createCount) > 2000
                        }
                        data-disabled-reason="Enter a name and a whole quantity between 1 and 100."
                      >
                        Create &amp; add to plan
                      </button>
                    </div>
                  </form>
                )}
                <div className="table-picker">
                  <span className="picker-label">{hall.name} tables</span>
                  <button
                    className="picker-trigger"
                    aria-label="Select tables"
                    aria-expanded={pickerOpen}
                    onClick={() => setPickerOpen((v) => !v)}
                  >
                    <span>
                      {bulkTables.length
                        ? `${bulkTables.length} tables selected`
                        : catalogPick?.placed
                          ? catalogPick.name
                          : 'Choose tables'}
                    </span>
                    <span>⌄</span>
                  </button>
                  {pickerOpen && (
                    <div className="picker-menu">
                      {tables.some((t) => !t.placed) && (
                        <label className="picker-all">
                          <input
                            type="checkbox"
                            aria-label="Select all available tables"
                            checked={tables
                              .filter((t) => !t.placed)
                              .every((t) => checkedTables.includes(t.id))}
                            onChange={(e) =>
                              setCheckedTables(
                                e.target.checked
                                  ? tables.filter((t) => !t.placed).map((t) => t.id)
                                  : [],
                              )
                            }
                          />
                          Select all available
                        </label>
                      )}
                      {!tables.length && (
                        <p className="picker-empty">
                          No tables yet. Create a table to get started.
                        </p>
                      )}
                      {tables.map((t) =>
                        t.placed ? (
                          <button
                            key={t.id}
                            className="placed-option"
                            onClick={() => {
                              setPick(t.id);
                              setCheckedTables([]);
                              setPickerOpen(false);
                            }}
                          >
                            <span>{t.name}</span>
                            <small>On plan · Edit</small>
                          </button>
                        ) : (
                          <label className="picker-option" key={t.id}>
                            <input
                              type="checkbox"
                              aria-label={`Select ${t.name}`}
                              checked={checkedTables.includes(t.id)}
                              onChange={(e) =>
                                setCheckedTables((ids) =>
                                  e.target.checked
                                    ? [...ids, t.id]
                                    : ids.filter((id) => id !== t.id),
                                )
                              }
                            />
                            <span>
                              {t.name}
                              <small>
                                {t.chairs.length} guests · {labels[t.shape]}
                              </small>
                            </span>
                          </label>
                        ),
                      )}
                    </div>
                  )}
                </div>
                <button
                  className="add-button"
                  onClick={add}
                  data-disabled-reason={
                    !hall.id
                      ? 'Create a hall first.'
                      : !tables.length
                        ? 'Create tables first, then select them.'
                        : 'Select at least one table from the list.'
                  }
                  disabled={!bulkTables.length && !catalogPick?.placed}
                >
                  <Icon name={bulkTables.length ? 'plus' : 'cursor'} />
                  {bulkTables.length
                    ? `Add selected tables (${bulkTables.length})`
                    : catalogPick?.placed
                      ? 'Edit selected table'
                      : 'Add selected tables'}
                </button>
                <p className="helper">Only tables belonging to this hall are shown.</p>
              </section>
              <section className="selection-section" hidden={panel !== 'selection'}>
                <div className="editor-nav">
                  <button
                    className="back-tables"
                    onClick={() => {
                      setPick(table?.id ?? '');
                      setCheckedTables([]);
                      setPickerOpen(false);
                      setPanel('tables');
                    }}
                  >
                    <Icon name="undo" />
                    {table?.shape.startsWith('sofa-') ? 'Back to sofas' : 'Back to tables'}
                  </button>
                  <div className="edit-history">
                    <button
                      title="Undo edit"
                      aria-label="Undo edit"
                      data-disabled-reason="No changes to undo."
                      disabled={!past.current.length}
                      onClick={undo}
                    >
                      <Icon name="undo" />
                    </button>
                    <button
                      title="Redo edit"
                      aria-label="Redo edit"
                      data-disabled-reason="No changes to redo."
                      disabled={!future.current.length}
                      onClick={redo}
                    >
                      <Icon name="redo" />
                    </button>
                  </div>
                </div>
                <div className="section-heading">
                  <h2>
                    <Icon name="cursor" />
                    {chair
                      ? 'Chair properties'
                      : table?.shape.startsWith('sofa-')
                        ? 'Selected sofa'
                        : 'Selected table'}
                  </h2>
                  <span>03</span>
                </div>
                {table ? (
                  <>
                    <div className="selected-name">
                      <strong>
                        {table.name}
                        {chair ? ' / Chair' : ''}
                      </strong>
                      <span>
                        {chair ? 'CHAIR' : table.shape.startsWith('sofa-') ? 'SOFA' : 'TABLE'}
                      </span>
                    </div>
                    {!chair && (
                      <>
                        <label className="field">
                          {table.shape.startsWith('sofa-') ? 'Sofa name' : 'Table name'}
                          <input
                            value={table.name}
                            onChange={(e) => update({ name: e.target.value })}
                          />
                        </label>
                        <label className="field">
                          {table.shape.startsWith('sofa-') ? 'Sofa shape' : 'Table shape'}
                          <select
                            value={table.shape}
                            onChange={(e) => {
                              const shape = e.target.value as Shape;
                              update({
                                shape,
                                ...(shape === 'circle' || shape === 'square'
                                  ? { height: table.width }
                                  : shape === 'rectangle' && table.width === table.height
                                    ? {
                                        width: Math.max(80, table.width),
                                        height: Math.max(
                                          40,
                                          Math.round(Math.max(80, table.width) * 0.55),
                                        ),
                                      }
                                    : {}),
                              });
                            }}
                          >
                            {Object.entries(labels).map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="two">
                          <Num
                            label="Width (cm)"
                            value={table.width}
                            min={40}
                            max={400}
                            onChange={(width) =>
                              update({
                                width,
                                ...(table.shape === 'circle' || table.shape === 'square'
                                  ? { height: width }
                                  : {}),
                              })
                            }
                          />
                          <Num
                            label="Length (cm)"
                            value={table.height}
                            min={40}
                            max={400}
                            onChange={(height) =>
                              update({
                                height,
                                ...(table.shape === 'circle' || table.shape === 'square'
                                  ? { width: height }
                                  : {}),
                              })
                            }
                          />
                        </div>
                      </>
                    )}
                    {chair && (
                      <div className="two">
                        <Num
                          label="Width (cm)"
                          value={chair.width ?? 34}
                          min={20}
                          max={100}
                          onChange={(width) =>
                            update({
                              chairs: table.chairs.map((c) =>
                                c.id === chair.id ? { ...c, width } : c,
                              ),
                            })
                          }
                        />
                        <Num
                          label="Length (cm)"
                          value={chair.height ?? 34}
                          min={20}
                          max={100}
                          onChange={(height) =>
                            update({
                              chairs: table.chairs.map((c) =>
                                c.id === chair.id ? { ...c, height } : c,
                              ),
                            })
                          }
                        />
                      </div>
                    )}
                    <div className="two">
                      <Num
                        label={chair ? 'Relative X (cm)' : 'X (cm)'}
                        value={chair?.x ?? table.x}
                        onChange={(x) =>
                          chair
                            ? update({
                                chairs: table.chairs.map((c) =>
                                  c.id === chair.id ? { ...c, x } : c,
                                ),
                              })
                            : update({ x })
                        }
                      />
                      <Num
                        label={chair ? 'Relative Y (cm)' : 'Y (cm)'}
                        value={chair?.y ?? table.y}
                        onChange={(y) =>
                          chair
                            ? update({
                                chairs: table.chairs.map((c) =>
                                  c.id === chair.id ? { ...c, y } : c,
                                ),
                              })
                            : update({ y })
                        }
                      />
                    </div>
                    <Num
                      label="Rotation (°)"
                      value={chair?.rotation ?? table.rotation}
                      min={-360}
                      max={360}
                      onChange={(rotation) =>
                        chair
                          ? update({
                              chairs: table.chairs.map((c) =>
                                c.id === chair.id ? { ...c, rotation } : c,
                              ),
                            })
                          : update({ rotation })
                      }
                    />
                    {!chair && !table.shape.startsWith('sofa-') && (
                      <>
                        <div className="chair-counter">
                          <span>
                            <Icon name="users" />
                            Seating
                          </span>
                          <div>
                            <button
                              aria-label="Remove chair"
                              data-disabled-reason="This table has no chairs to remove."
                              disabled={!table.chairs.length}
                              onClick={() => update({ chairs: table.chairs.slice(0, -1) })}
                            >
                              −
                            </button>
                            <b>{table.chairs.length}</b>
                            <button
                              aria-label="Add chair"
                              data-disabled-reason="A table can have at most 30 chairs."
                              disabled={table.chairs.length >= 30}
                              onClick={() => addChair(table)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <button
                          className="subtle"
                          onClick={() =>
                            update({ chairs: arrange(table, table.chairs.length, table.chairs) })
                          }
                        >
                          Redistribute chairs
                        </button>
                      </>
                    )}
                    <button className="danger" onClick={remove}>
                      <Icon name="trash" />
                      {chair ? 'Delete chair' : 'Remove table from plan'}
                    </button>
                    <div className="id-line">
                      ID <code>{chair?.id ?? table.id}</code>
                    </div>
                  </>
                ) : (
                  <div className="empty">
                    <Icon name="cursor" />
                    <strong>Select a table</strong>
                    <p>
                      Click a table on the floor plan to edit its shape, dimensions and seating.
                    </p>
                  </div>
                )}
              </section>
            </aside>
          </div>
          <section className={`data-panel ${showData ? 'data-open' : ''}`}>
            <button className="close-panel" title="Close data" onClick={() => setShowData(false)}>
              ×
            </button>
            <div className="data-header">
              <div>
                <button
                  className={tab === 'relations' ? 'selected-tab' : ''}
                  onClick={() => setTab('relations')}
                >
                  Hall ↔ Table relations
                </button>
                <button
                  className={tab === 'json' ? 'selected-tab' : ''}
                  onClick={() => setTab('json')}
                >
                  Layout JSON
                </button>
                <button
                  className={tab === 'selected' ? 'selected-tab' : ''}
                  onClick={() => setTab('selected')}
                >
                  Selected object
                </button>
              </div>
              <span>
                <span className="dot" />
                LIVE STRUCTURE <code>v1 · cm</code>
              </span>
            </div>
            <pre>
              {JSON.stringify(
                tab === 'json'
                  ? doc
                  : tab === 'selected'
                    ? (chair ?? table ?? hall)
                    : {
                        hall: { id: hall.id, name: hall.name },
                        tables: tables.map((t) => ({
                          id: t.id,
                          hallId: t.hallId,
                          name: t.name,
                          placed: t.placed,
                          chairCount: t.chairs.length,
                        })),
                      },
                null,
                2,
              )}
            </pre>
          </section>
          <footer className="status" aria-live="polite">
            <span>
              <span className="dot" />
              {status}
            </span>
            <span>
              ⌘ Z Undo <span>·</span> Delete Remove <span>·</span> Esc Deselect
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
