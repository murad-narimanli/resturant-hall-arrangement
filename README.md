# Floorplan — Restaurant Layout Studio

A standalone React + TypeScript + Vite project. Existing restaurant repositories were not modified. The interface and all initial data are English. The application starts with **zero halls and zero tables**. Create your first hall, create a table in its catalog, and add it to the floor plan. Newly created tables have zero chairs; add and redistribute chairs as needed.

## Run

```sh
npm install
npm run dev -- --port 5178
npm run build
npm run preview -- --port 4178
npm test
```

Open http://127.0.0.1:5178. Browser tests use the installed macOS Google Chrome path in `playwright.config.ts`; change it for other machines. The browser tests expect the development server on port 5178.

## Implemented

- Fixed-height application shell with header and sidebar; no page scrolling. Fullscreen mode hides the shell.
- Map-style canvas: drag empty space to pan, mouse wheel or buttons to zoom, fit button to reset the view.
- Floating tools and one contextual inspector at a time (Hall, Tables, or selected object). Live data opens as an optional overlay.
- Numeric fields accept an empty draft while typing; values are validated on blur or Enter.

- Empty start, create/rename halls and tables, stable UUIDs, hall-scoped table catalog and dependent dropdown.
- Square, rectangle, circle and custom-dimension halls; rectangle, square, round and organic tables.
- SVG floor plan with grid, individual pointer drag of tables and chairs, table resize handle, numeric sizes, positions and rotation.
- Chairs use parent-local coordinates and rotation. Moving a table moves its chairs as a group. Rotating a table rotates its chairs as a group. Resizing or changing the shape redistributes chairs around the new dimensions, preserving chair IDs and sizes. Add/remove up to 30 chairs and redistribute around the table.
- Snap to 10 cm (enabling aligns placed objects in the active hall), live alignment guides, zoom, fit, selection, delete and 80-step undo/redo. A complete drag is one history entry.
- Automatic localStorage persistence, explicit save, JSON download and validated JSON upload (2 MB limit).
- Live hall/table relations, full serializable JSON and selected-object tabs.
- Responsive controls and original local SVG toolbar and transform-handle icons from the supplied Figma library.

## Architecture and actual persistence

`src/model.ts` owns types, arrangement and validation. `src/App.tsx` owns document/history/selection and SVG interaction. `src/style.css` uses the supplied ReservBox design-system colors (primary `#18a559`, dark `#08351d`, mint `#edfcf4`, neutral `#f5f5f5`) and Inter. Figma was only read; its files were not edited. Branding icons were removed at the user's request. Inter is requested from Google Fonts with an Arial fallback. Original Figma SVG assets are in `public/icons` and are not temporary runtime URLs.

The only implemented persistence is the browser's `floorplan-empty-v2` localStorage key. No API or database is implemented. The empty-start key intentionally isolates earlier development sample data. Persistence is per browser origin; clearing browser storage removes it. JSON export provides a portable backup. Storage errors are shown in the status bar. Imported documents replace the current document and can be undone. UI selection, active hall, zoom and history are transient; all hall/table/chair layout data survives reload. The optional `seed()` model helper contains English sample data for development and is **never loaded automatically**.

## Serializable schema v1

```ts
type Layout = {
  schemaVersion: 1;
  units: 'cm';
  halls: {
    id: string;
    name: string;
    shape: 'rectangle' | 'square' | 'circle' | 'custom';
    width: number;
    height: number;
  }[];
  tables: {
    id: string;
    hallId: string;
    name: string;
    shape: 'rectangle' | 'square' | 'circle' | 'organic';
    width: number;
    height: number;
    x: number;
    y: number;
    rotation: number;
    placed: boolean;
    chairs: { id: string; x: number; y: number; rotation: number }[];
  }[];
};
```

Hall origin is the top-left bounding box. X increases right, Y increases down, 1 document unit = 1 cm. A table position is its center in hall coordinates; its positive rotation is clockwise in degrees. Chair positions are relative to the table center before table rotation. Chair orientation is relative to the table. World chair position is `table.position + rotate(chair.position, table.rotation)`; world orientation is the sum. Unplaced catalog tables retain their geometry and IDs. Organic geometry uses a deterministic normalized Bézier path scaled by width/height; arbitrary freehand polygons are not implemented. `custom` halls currently mean custom rectangular dimensions, not a polygon.

Validation rejects unknown schema versions/units, duplicate/empty IDs, nonexistent hall ownership, nonfinite/out-of-range numbers, invalid enums and oversized counts. Hall dimensions are 300–3000 cm; table dimensions 40–400 cm; rotations −360…360; coordinates −5000…5000; at most 100 halls, 2000 tables and 30 chairs per table. Empty documents are valid. Drag limits table centers to the hall bounding box, but normal direct drags still limit table centers; collision checks are not implemented. Hall dimension/shape edits fit each complete group inside the hall, translating first and scaling oversized furniture if necessary. Circular halls use a conservative inscribed region.

## Proposed backend integration — not implemented

Store restaurants/tenants, halls, table inventory and versioned layout documents. Assign immutable server-authoritative hall/table IDs (UUID recommended), enforce `hall.restaurant_id` and `table.hall_id` with foreign keys, and derive tenant ownership from authenticated membership, never a client-supplied owner. Chair IDs must remain stable inside a layout. A JSONB layout can contain the schema above; alternatively normalize chairs and geometry with the same transaction boundary. Keep `schemaVersion`, revision, updatedAt and updatedBy server-side. Preserve the catalog relationship for unplaced tables.

Suggested contracts:

- `GET /api/restaurants/:restaurantId/layout` → `200 { document: Layout, revision: 12, updatedAt: ISO8601 }` plus a strong `ETag: "12"`.
- `PUT /api/restaurants/:restaurantId/layout` with `If-Match: "12"` and `{ document: Layout }` → atomic validation and replace; return `200 { document, revision: 13, updatedAt }` plus `ETag: "13"`.
- Missing initial document: `404`; first creation may use `PUT` with `If-None-Match: *` and return `201`. Define this consistently in the backend.
- `400` malformed JSON, `401` unauthenticated, `403` tenant access denied, `413` oversized body, `422 { errors: [{ path, code, message }] }` invalid schema/ownership, `412` stale revision.
- On `412`, fetch latest and let the user resolve conflicts; never silently overwrite. Save catalog ownership changes and the layout in one database transaction. Add request size/count limits, CSRF protection where cookie authentication is used, audit history and backups. Apply allowlisted schema validation on the server, including actual bounds and collision policy if required. A browser import is not trusted authorization.

A future adapter should expose `load(): Promise<Layout>` and `save(document, revision): Promise<SaveResult>`. Replace the local effect with debounced API saves and explicit loading/saving/failure states. Persist the acknowledged revision and retry safely. Multi-user editing and cross-tab merging are not implemented.

## Verification and limitations

Production build uses strict TypeScript. Playwright covers empty start, creating halls and tables, dependent dropdown ownership, pointer drag of a table and chair, chair deletion, undo, reload persistence, valid/invalid JSON import, download, runtime errors, and mobile overflow. Screenshots are written to `tests/desktop.png` and `tests/mobile.png`.

Selection is single-object. No multi-select, collision prevention, arbitrary wall drawing, real backend, authentication or collaborative editing. Tables and chairs both have canvas resize and rotation handles, plus numeric inspector controls. Rotation snaps to 15° when snap is enabled. Chair width/height are optional v1 fields defaulting to 34 cm for earlier documents, bounded to 20–100 cm. Manual hall dimension edits switch to Custom dimensions. Switching a square table to Rectangle supplies a distinct rectangular aspect ratio. Table deletion removes it from the plan while keeping inventory identity. Hall and inventory deletion are not yet exposed.

## Official references consulted

- [React: updating objects in state](https://react.dev/learn/updating-objects-in-state): immutable document updates.
- [MDN: pointer capture](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture): continuous drag handling.
- [MDN: localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage): browser-local persistence and storage constraints.
- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#name-if-match): conditional saves and lost-update prevention for the proposed API.
- [ReservBox Design System](https://www.figma.com/design/QEBuQyyw1hG2kEkjuOaBDP/ReservBox-Design-System): colors `3:4801`, typography `3:622`, icons from page `3:7`; read-only reference.

Transform handles use the original Figma `expand-04` (`3:3004`) and `refresh-cw-01` (`3:3026`) assets with hover tooltips. Snap is beside Tables and explains its 10 cm alignment behavior in a tooltip.

The editor inspector includes Back to tables and compact icon-only Undo/Redo. Placed tables can be reopened from the catalog without duplication. Explicit Save writes both the current document and a timestamped local snapshot (`floorplan-last-save-v1`), confirms with a toast and a temporary Saved button label, and reports storage failures. This remains browser-local persistence, not a backend save.

The table catalog uses a custom checkbox picker with Select all available. Multiple unplaced tables can be added together, positioned in separate slots, and undone in one operation. Already placed tables appear as Edit entries and are never duplicated. Batch selection resets on hall changes; every table remains bound to its original hall ID.

Create table opens a separate inline form for a name prefix, quantity (1–100 per batch, total inventory limit 2000), and table shape. Names are generated as VIP 01, VIP 02, etc., skipping existing names within the hall. New tables are selected for bulk insertion, but the checkbox picker stays closed until opened explicitly.

Create form values reset to Table / 1 / Rectangle after creation or successful explicit save. Selected tables have an on-canvas Add chair (+) control. Hall settings reveal a bottom-right canvas resize handle; a hall resize is one undoable operation and switches the hall to Custom dimensions. Reset all asks for confirmation, then removes all geometry, explicit local save snapshot and history, and restores an empty editor.

Adding a chair automatically redistributes seats by table shape. Four seats on square/rectangular tables use one per edge; extra seats favor longer edges. Round/organic tables use an even ring. Existing chair IDs and dimensions are retained during redistribution. Disabled controls show a hover tooltip explaining the missing prerequisite, history state, quantity error, or chair limit.

Selected tables expose a Duplicate icon from the original Figma copy-01 asset. A duplicate includes chair geometry and dimensions with new table/chair UUIDs, a unique copy name, and a small position offset fitted to the active hall. It is one undoable operation. Transform, add-chair and copy controls are positioned beyond the complete furniture bounds to avoid overlapping seats.

Format source with `npm run format`; verify with `npm run format:check`. Prettier uses 2-space indentation, semicolons, single quotes and a 100-character line width. Original exported Figma icons and generated files are excluded.

Shape choices also include Straight sofa, Corner sofa and Semicircular sofa. These serialize using `sofa-straight`, `sofa-corner` and `sofa-semicircle` shape values and share the move, resize, rotate, copy and delete controls. Sofas do not have individual chair-add controls.

A right-side Quick furniture library inserts table/sofa presets immediately with one click, without opening a form. The existing Add table/Add sofa buttons continue to open the detailed creator. Selected sofas use sofa-specific inspector labels. Double-click a furniture body/name to rename directly on the canvas; Enter or blur commits the name, Escape cancels.
