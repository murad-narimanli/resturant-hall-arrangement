import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
async function createOneTable(page: Page) {
  await page.getByRole('button', { name: 'Create table', exact: true }).click();
  await page.getByRole('button', { name: 'Create tables', exact: true }).click();
}
test('empty start, creation, ownership, drag, history, import/export and reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:5178');
  await expect(page.locator('[data-table-id]')).toHaveCount(0);
  await expect(page.getByText('Your space. A fresh start.')).toBeVisible();
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await createOneTable(page);
  await page.getByRole('button', { name: 'Add selected tables (1)' }).click();
  await expect(page.locator('[data-table-id]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Add chair', exact: true }).click();
  await page.getByRole('button', { name: 'Add chair', exact: true }).click();
  await page.getByRole('button', { name: 'Redistribute chairs' }).click();
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('floorplan-empty-v2')!));
  let d = await stored();
  const id = d.tables[0].id;
  const table = page.locator(`[data-table-id="${id}"]`);
  await table.scrollIntoViewIfNeeded();
  const b = (await table.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 65, b.y + b.height / 2 + 25, { steps: 8 });
  await page.mouse.up();
  d = await stored();
  expect(d.tables[0].x).not.toBe(600);
  const moved = d.tables[0].x;
  const ch = page.locator('[data-chair-id]').first();
  await ch.scrollIntoViewIfNeeded();
  const cb = (await ch.boundingBox())!;
  await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await page.mouse.down();
  await page.mouse.move(cb.x + cb.width / 2 + 30, cb.y + cb.height / 2 + 20, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByText('Chair properties')).toBeVisible();
  await page.getByRole('button', { name: 'Delete chair', exact: true }).click();
  d = await stored();
  expect(d.tables[0].chairs).toHaveLength(1);
  await page.getByTitle('Undo (⌘Z)').click();
  d = await stored();
  expect(d.tables[0].chairs).toHaveLength(2);
  await page.getByTitle('Create hall', { exact: true }).click();
  await expect(page.locator('[data-table-id]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await page.getByRole('button', { name: 'Select tables', exact: true }).click();
  await expect(page.getByText('No tables yet. Create a table to get started.')).toBeVisible();
  await page.getByLabel('Select hall').selectOption(d.halls[0].id);
  await expect(table).toBeVisible();
  await page.reload();
  await expect(table).toBeVisible();
  d = await stored();
  expect(d.tables[0].x).toBe(moved);
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await page.getByRole('button', { name: 'Layout JSON', exact: true }).click();
  await expect(page.locator('pre')).toContainText('schemaVersion');
  await page.locator('input[type=file]').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"schemaVersion":99}'),
  });
  await expect(page.getByText(/Import failed/)).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({
    name: 'good.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(d)),
  });
  await expect(table).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('floorplan-layout.json');
  await page.screenshot({ path: 'tests/desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('empty mobile layout has no overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:5178');
  await expect(page.getByRole('button', { name: 'Create your first hall' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'tests/mobile.png', fullPage: true });
});

test('dimension fields allow clearing and typing before validation', async ({ page }) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  const width = page.getByRole('spinbutton', { name: 'Width (cm)', exact: true });
  await width.fill('300');
  await width.press('Tab');
  await width.fill('');
  await expect(width).toHaveValue('');
  await width.pressSequentially('1200');
  await expect(width).toHaveValue('1200');
  await width.press('Enter');
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('floorplan-empty-v2')!).halls[0].width,
    ),
  ).toBe(1200);
  await width.fill('12');
  await expect(width).toHaveValue('12');
  await width.press('Tab');
  await expect(width).toHaveValue('300');
  await width.fill('');
  await width.press('Tab');
  await expect(width).toHaveValue('300');
  await width.fill('4000');
  await width.press('Tab');
  await expect(width).toHaveValue('3000');
  await page.reload();
  await page.getByRole('button', { name: 'Hall', exact: true }).click();
  await expect(width).toHaveValue('3000');
});

test('map canvas fills viewport and pans and zooms without page scroll', async ({ page }) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByTitle('Close panel', { exact: true }).click();
  const canvas = page.locator('svg.canvas');
  const before = await canvas.getAttribute('viewBox');
  await page.mouse.move(700, 450);
  await page.mouse.down();
  await page.mouse.move(760, 490, { steps: 8 });
  await page.mouse.up();
  expect(await canvas.getAttribute('viewBox')).not.toBe(before);
  const panned = await canvas.getAttribute('viewBox');
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(100);
  expect(await canvas.getAttribute('viewBox')).not.toBe(panned);
  expect(
    await page.evaluate(() => ({
      height: document.documentElement.scrollHeight,
      viewport: innerHeight,
    })),
  ).toEqual({ height: 1000, viewport: 1000 });
  await page.screenshot({ path: 'tests/map.png' });
});

test('normal shell stays visible and fullscreen hides it without page scroll', async ({ page }) => {
  await page.goto('http://127.0.0.1:5178');
  await expect(page.locator('header')).toBeVisible();
  await expect(page.locator('.rail')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(1000);
  await page.getByTitle('Fullscreen', { exact: true }).click();
  await expect(page.locator('header')).toBeHidden();
  await expect(page.locator('.rail')).toBeHidden();
  await expect(page.locator('.app')).toHaveClass(/fullscreen-mode/);
  await page.getByTitle('Exit fullscreen', { exact: true }).click();
  await expect(page.locator('header')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(1000);
  await page.screenshot({ path: 'tests/page-shell.png' });
});

test('small tables scale their labels and floating tool groups have gaps', async ({ page }) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await createOneTable(page);
  await page.getByRole('button', { name: 'Add selected tables (1)' }).click();
  const panel = page.locator('.selection-section');
  await panel.getByRole('spinbutton', { name: 'Width (cm)', exact: true }).fill('40');
  await panel.getByRole('spinbutton', { name: 'Width (cm)', exact: true }).press('Enter');
  await panel.getByRole('spinbutton', { name: 'Length (cm)', exact: true }).fill('40');
  await panel.getByRole('spinbutton', { name: 'Length (cm)', exact: true }).press('Enter');
  const text = page.locator('[data-table-id] text');
  await expect(text).toHaveAttribute('transform', /scale\(0\./);
  const name = await page.locator('[data-table-id] text tspan').first().boundingBox();
  const rect = await page.locator('[data-table-id]>rect').boundingBox();
  expect(name!.width).toBeLessThan(rect!.width * 0.85);
  const hall = await page.locator('.editor-top').boundingBox(),
    modes = await page.locator('.map-modes').boundingBox(),
    tools = await page.locator('.toolbar').boundingBox(),
    snap = await page.locator('.snap').boundingBox();
  expect(modes!.y - (hall!.y + hall!.height)).toBeGreaterThanOrEqual(12);
  expect(tools!.y - (modes!.y + modes!.height)).toBeGreaterThanOrEqual(12);
  expect(Math.abs(snap!.y - modes!.y)).toBeLessThan(3);
  await page.screenshot({ path: 'tests/small-table.png' });
});

test('table and chair resize and rotate directly on canvas and survive reload', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await createOneTable(page);
  await page.getByRole('button', { name: 'Add selected tables (1)' }).click();
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('floorplan-empty-v2')!));
  const drag = async (selector: string, dx: number, dy: number) => {
    const h = page.locator(selector);
    await h.scrollIntoViewIfNeeded();
    const b = (await h.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps: 8 });
    await page.mouse.up();
  };
  await drag('[data-handle="table-resize"]', 25, 15);
  let d = await stored();
  expect(d.tables[0].width).toBeGreaterThan(160);
  await drag('[data-handle="table-rotate"]', 65, 40);
  d = await stored();
  expect(d.tables[0].rotation).not.toBe(0);
  await page.getByRole('button', { name: 'Add chair', exact: true }).click();
  await page.locator('[data-chair-id]>g').first().click();
  await drag('[data-handle="chair-resize"]', 30, 10);
  d = await stored();
  expect(d.tables[0].chairs[0].width).toBeGreaterThanOrEqual(20);
  expect(d.tables[0].chairs[0].width).toBeDefined();
  const before = d.tables[0].chairs[0].rotation;
  await drag('[data-handle="chair-rotate"]', 45, 35);
  d = await stored();
  expect(d.tables[0].chairs[0].rotation).not.toBe(before);
  const expected = d.tables[0];
  await page.reload();
  d = await stored();
  expect(d.tables[0]).toEqual(expected);
  await page.locator('[data-table-id]').click();
  await page.screenshot({ path: 'tests/transform-controls.png' });
});

test('square and rectangle are distinct and manual hall sizes select custom', async ({ page }) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByRole('combobox', { name: 'Hall shape', exact: true }).selectOption('square');
  const width = page.getByRole('spinbutton', { name: 'Width (cm)', exact: true });
  await width.fill('900');
  await width.press('Enter');
  await expect(page.getByRole('combobox', { name: 'Hall shape', exact: true })).toHaveValue(
    'custom',
  );
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await createOneTable(page);
  await page.getByRole('button', { name: 'Add selected tables (1)' }).click();
  const shape = page.getByRole('combobox', { name: 'Table shape', exact: true });
  await shape.selectOption('square');
  let table = await page.evaluate(
    () => JSON.parse(localStorage.getItem('floorplan-empty-v2')!).tables[0],
  );
  expect(table.width).toBe(table.height);
  await shape.selectOption('rectangle');
  table = await page.evaluate(
    () => JSON.parse(localStorage.getItem('floorplan-empty-v2')!).tables[0],
  );
  expect(table.width).toBeGreaterThan(table.height * 1.5);
});

test('snap aligns existing objects and handles use pack icons with tooltips', async ({ page }) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await createOneTable(page);
  await page.getByRole('button', { name: 'Add selected tables (1)' }).click();
  const checkbox = page.getByRole('checkbox', { name: 'Snap to grid', exact: true });
  await checkbox.uncheck();
  const x = page.getByRole('spinbutton', { name: 'X (cm)', exact: true });
  await x.fill('613');
  await x.press('Enter');
  await checkbox.check();
  await expect(x).toHaveValue('610');
  const rotate = page.locator('[data-handle="table-rotate"]');
  await expect(rotate.locator('image')).toHaveAttribute('href', '/icons/rotate.svg');
  await rotate.hover();
  await expect(page.getByRole('tooltip')).toContainText('Drag to rotate');
  await page.locator('.snap-chip').hover();
  await expect(page.getByRole('tooltip')).toContainText('10 cm');
  const b = (await page.locator('[data-table-id]').boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 37, b.y + b.height / 2 + 23, { steps: 5 });
  await expect(page.locator('.snap-guides')).toBeVisible();
  await page.mouse.up();
  const d = await page.evaluate(() => JSON.parse(localStorage.getItem('floorplan-empty-v2')!));
  expect(d.tables[0].x % 10).toBe(0);
  expect(d.tables[0].y % 10).toBe(0);
  await page.screenshot({ path: 'tests/icon-handles.png' });
});

test('drag prevents native text selection and uses compact handles', async ({ page }) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await createOneTable(page);
  await page.getByRole('button', { name: 'Add selected tables (1)' }).click();
  const visual = page.locator('[data-handle="table-rotate"] .handle-visual');
  await expect(visual).toHaveAttribute('transform', 'rotate(0) scale(.65)');
  await page.evaluate(() => {
    const t = document.querySelector('[data-table-id] text')!;
    const r = document.createRange();
    r.selectNodeContents(t);
    window.getSelection()?.addRange(r);
  });
  const box = (await page.locator('[data-table-id]').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, { steps: 5 });
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('');
  await page.mouse.up();
  await page.screenshot({ path: 'tests/compact-handles.png' });
});

test('table resizing reflows chairs and rotation moves the whole group', async ({ page }) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await createOneTable(page);
  await page.getByRole('button', { name: 'Add selected tables (1)', exact: true }).click();
  for (let i = 0; i < 4; i++)
    await page.getByRole('button', { name: 'Add chair', exact: true }).click();
  const stored = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('floorplan-empty-v2')!).tables[0]);
  const before = await stored();
  const width = page.getByRole('spinbutton', { name: 'Width (cm)', exact: true });
  await width.fill('300');
  await width.press('Enter');
  let t = await stored();
  expect(t.chairs.map((c: any) => c.id)).toEqual(before.chairs.map((c: any) => c.id));
  expect(Math.max(...t.chairs.map((c: any) => c.x))).toBeGreaterThan(
    Math.max(...before.chairs.map((c: any) => c.x)),
  );
  const locals = t.chairs;
  const rotation = page.getByRole('spinbutton', { name: 'Rotation (°)', exact: true });
  await rotation.fill('90');
  await rotation.press('Enter');
  t = await stored();
  expect(t.rotation).toBe(90);
  expect(t.chairs).toEqual(locals);
  const handle = (await page.locator('[data-handle="table-resize"]').boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 - 30, handle.y + handle.height / 2 + 30, {
    steps: 8,
  });
  await page.mouse.up();
  t = await stored();
  expect(t.width).not.toBe(300);
  expect(t.chairs.map((c: any) => c.id)).toEqual(locals.map((c: any) => c.id));
  const expected = t;
  await page.reload();
  expect(await stored()).toEqual(expected);
});

test('pinch-wheel zoom affects only canvas and the expanded data box is readable', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  const header = await page.locator('header').boundingBox(),
    toolbar = await page.locator('.toolbar').boundingBox();
  const svg = page.locator('svg.canvas'),
    before = await svg.getAttribute('viewBox');
  const prevented = await svg.evaluate((el) => {
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY: -30,
    });
    el.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(true);
  await expect(svg).not.toHaveAttribute('viewBox', before!);
  expect(await page.locator('header').boundingBox()).toEqual(header);
  expect(await page.locator('.toolbar').boundingBox()).toEqual(toolbar);
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  const data = (await page.locator('.data-panel').boundingBox())!;
  expect(data.width).toBeGreaterThan(1100);
  expect(data.height).toBeGreaterThan(400);
  await page.screenshot({ path: 'tests/data-zoom.png' });
});

test('edit inspector undo redo keeps the table selected', async ({ page }) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await createOneTable(page);
  await page.getByRole('button', { name: 'Add selected tables (1)' }).click();
  const name = page.getByRole('textbox', { name: 'Table name', exact: true });
  await name.fill('Window table');
  await page.getByTitle('Undo edit', { exact: true }).click();
  await expect(name).toHaveValue('Table 01');
  await expect(page.locator('[data-table-id].selected')).toHaveCount(1);
  await page.getByTitle('Redo edit', { exact: true }).click();
  await expect(name).toHaveValue('Window table');
  await expect(page.locator('[data-table-id].selected')).toHaveCount(1);
});

test('back navigation allows changing table selection without duplicating placed tables', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await createOneTable(page);
  await page.getByRole('button', { name: 'Add selected tables (1)' }).click();
  await page.getByRole('button', { name: /Back to (tables|sofas)/ }).click();
  await createOneTable(page);
  await page.getByRole('button', { name: 'Add selected tables (1)' }).click();
  await expect(page.getByRole('textbox', { name: 'Table name', exact: true })).toHaveValue(
    'Table 02',
  );
  await page.getByRole('button', { name: /Back to (tables|sofas)/ }).click();
  await page.getByRole('button', { name: 'Select tables', exact: true }).click();
  await expect(page.locator('.placed-option')).toHaveCount(2);
  await page.locator('.placed-option').first().click();
  await page.getByRole('button', { name: 'Edit selected table', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Table name', exact: true })).toHaveValue(
    'Table 01',
  );
  await expect(page.locator('[data-table-id]')).toHaveCount(2);
  await expect(page.getByTitle('Undo edit')).toHaveText('');
});

test('save layout gives clear confirmation and writes a restorable document', async ({ page }) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByTitle('Save layout to this browser', { exact: true }).click();
  await expect(page.locator('.save-notice.success')).toBeVisible();
  await expect(page.getByTitle('Save layout to this browser')).toHaveText('Saved');
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('floorplan-last-save-v1')!),
  );
  expect(saved.document.halls).toHaveLength(1);
  expect(Number.isNaN(Date.parse(saved.savedAt))).toBe(false);
  await page.reload();
  await expect(page.getByLabel('Select hall')).toContainText('Hall 1');
});

test('custom table picker bulk adds selected tables in a single undoable operation', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  for (let i = 0; i < 3; i++) await createOneTable(page);
  await page.getByRole('button', { name: 'Select tables', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Select Table 01', exact: true })).toBeChecked();
  await page.getByRole('checkbox', { name: 'Select Table 02', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Add selected tables (2)', exact: true }).click();
  await expect(page.locator('[data-table-id]')).toHaveCount(2);
  let tables = await page.evaluate(
    () => JSON.parse(localStorage.getItem('floorplan-empty-v2')!).tables,
  );
  expect(tables[1].placed).toBe(false);
  expect(tables[0].x).not.toBe(tables[2].x);
  await page.getByTitle('Undo (⌘Z)', { exact: true }).click();
  await expect(page.locator('[data-table-id]')).toHaveCount(0);
  await page.getByTitle('Redo (⌘⇧Z)', { exact: true }).click();
  await expect(page.locator('[data-table-id]')).toHaveCount(2);
  await page.getByRole('button', { name: 'Select tables', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Select all available tables', exact: true }).check();
  await page.getByRole('button', { name: 'Add selected tables (1)', exact: true }).click();
  await expect(page.locator('[data-table-id]')).toHaveCount(3);
  await page.reload();
  await expect(page.locator('[data-table-id]')).toHaveCount(3);
});

test('create dialog supports prefix quantity shape and keeps picker closed', async ({ page }) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await page.getByRole('button', { name: 'Create table', exact: true }).click();
  await expect(page.locator('.picker-menu')).toBeHidden();
  await page.getByRole('textbox', { name: 'Name prefix', exact: true }).fill('VIP');
  await page.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill('3');
  await page.getByRole('combobox', { name: 'Shape', exact: true }).selectOption('circle');
  await page.getByRole('button', { name: 'Create tables', exact: true }).click();
  await expect(page.locator('.picker-menu')).toBeHidden();
  await expect(page.locator('.create-table-form')).toBeHidden();
  await page.getByRole('button', { name: 'Add selected tables (3)', exact: true }).click();
  await expect(page.locator('[data-table-id]')).toHaveCount(3);
  let tables = await page.evaluate(
    () => JSON.parse(localStorage.getItem('floorplan-empty-v2')!).tables,
  );
  expect(tables.map((t: any) => t.name)).toEqual(['VIP 01', 'VIP 02', 'VIP 03']);
  expect(tables.every((t: any) => t.shape === 'circle' && t.width === t.height)).toBe(true);
  await page.getByRole('button', { name: 'Create table', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name prefix', exact: true })).toHaveValue(
    'Table',
  );
  await expect(page.getByRole('spinbutton', { name: 'Quantity', exact: true })).toHaveValue('1');
  await expect(page.getByRole('combobox', { name: 'Shape', exact: true })).toHaveValue('rectangle');
  await page.getByRole('textbox', { name: 'Name prefix', exact: true }).fill('VIP');
  await page.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill('3');
  await page.getByRole('button', { name: 'Create tables', exact: true }).click();
  tables = await page.evaluate(
    () => JSON.parse(localStorage.getItem('floorplan-empty-v2')!).tables,
  );
  expect(tables.slice(3).map((t: any) => t.name)).toEqual(['VIP 04', 'VIP 05', 'VIP 06']);
});

test('canvas add chair, draggable hall resize and reset everything', async ({ page }) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  const resize = page.locator('[data-handle="hall-resize"]'),
    b = (await resize.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 - 70, b.y + b.height / 2 - 40, { steps: 8 });
  await page.mouse.up();
  let d = await page.evaluate(() => JSON.parse(localStorage.getItem('floorplan-empty-v2')!));
  expect(d.halls[0].width).toBeLessThan(1200);
  expect(d.halls[0].height).toBeLessThan(800);
  expect(d.halls[0].shape).toBe('custom');
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await createOneTable(page);
  await page.getByRole('button', { name: 'Add selected tables (1)', exact: true }).click();
  await page.locator('[data-handle="table-add-chair"]').click();
  await expect(page.locator('[data-chair-id]')).toHaveCount(1);
  await page.getByTitle('Undo edit').click();
  await expect(page.locator('[data-chair-id]')).toHaveCount(0);
  await page.getByTitle('Redo edit').click();
  await expect(page.locator('[data-chair-id]')).toHaveCount(1);
  await page.getByTitle('Save layout to this browser').click();
  await page.getByTitle('Reset all', { exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('[data-table-id]')).toHaveCount(1);
  await page.getByTitle('Reset all', { exact: true }).click();
  await page.getByRole('button', { name: 'Reset everything', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create your first hall' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('floorplan-last-save-v1'))).toBeNull();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Create your first hall' })).toBeVisible();
});

test('disabled controls explain why in tooltips', async ({ page }) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByTitle('Undo (⌘Z)', { exact: true }).hover();
  await expect(page.getByRole('tooltip')).toHaveText('No changes to undo.');
  await page.getByRole('button', { name: 'Tables', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toHaveText('Create a hall first.');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await page.getByRole('button', { name: 'Add selected tables', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toHaveText('Create tables first, then select them.');
});

test('chairs automatically follow shape and hall shrink contains all furniture', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await createOneTable(page);
  await page.getByRole('button', { name: 'Add selected tables (1)', exact: true }).click();
  await page.getByRole('combobox', { name: 'Table shape', exact: true }).selectOption('square');
  for (let i = 0; i < 4; i++)
    await page.getByRole('button', { name: 'Add chair', exact: true }).click();
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('floorplan-empty-v2')!));
  let d = await stored(),
    t = d.tables[0];
  expect(t.chairs.filter((c: any) => c.x === 0)).toHaveLength(2);
  expect(t.chairs.filter((c: any) => c.y === 0)).toHaveLength(2);
  const ids = t.chairs.map((c: any) => c.id);
  await page.getByRole('button', { name: 'Add chair', exact: true }).click();
  d = await stored();
  expect(d.tables[0].chairs.slice(0, 4).map((c: any) => c.id)).toEqual(ids);
  await page.getByRole('spinbutton', { name: 'X (cm)', exact: true }).fill('1100');
  await page.getByRole('spinbutton', { name: 'X (cm)', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Hall', exact: true }).click();
  for (const name of ['Width (cm)', 'Length (cm)']) {
    const input = page.getByRole('spinbutton', { name, exact: true });
    await input.fill('300');
    await input.press('Enter');
  }
  const bounds = await page.locator('[data-table-id]').boundingBox(),
    room = await page.locator('.room').boundingBox();
  expect(bounds!.x).toBeGreaterThan(room!.x);
  expect(bounds!.x + bounds!.width).toBeLessThan(room!.x + room!.width);
  for (const box of await page.locator('[data-chair-id]').all()) {
    const b = (await box.boundingBox())!;
    expect(b.x).toBeGreaterThan(room!.x);
    expect(b.y).toBeGreaterThan(room!.y);
    expect(b.x + b.width).toBeLessThan(room!.x + room!.width);
    expect(b.y + b.height).toBeLessThan(room!.y + room!.height);
  }
});

test('on-canvas copy duplicates furniture with independent stable IDs', async ({ page }) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await createOneTable(page);
  await page.getByRole('button', { name: 'Add selected tables (1)', exact: true }).click();
  await page.getByRole('button', { name: 'Add chair', exact: true }).click();
  await page.getByRole('button', { name: 'Add chair', exact: true }).click();
  const rotation = page.getByRole('spinbutton', { name: 'Rotation (°)', exact: true });
  await rotation.fill('45');
  await rotation.press('Enter');
  await page.locator('[data-handle="table-copy"]').hover();
  await expect(page.getByRole('tooltip')).toHaveText('Duplicate table with chairs');
  await page.locator('[data-handle="table-copy"]').click();
  await expect(page.locator('[data-table-id]')).toHaveCount(2);
  const tables = await page.evaluate(
    () => JSON.parse(localStorage.getItem('floorplan-empty-v2')!).tables,
  );
  const [original, copy] = tables;
  expect(copy.id).not.toBe(original.id);
  expect(copy.name).toBe('Table 01 copy');
  expect(copy.hallId).toBe(original.hallId);
  expect(copy.rotation).toBe(original.rotation);
  expect(copy.width).toBe(original.width);
  expect(copy.height).toBe(original.height);
  expect(copy.x).not.toBe(original.x);
  expect(copy.chairs.map((c: any) => ({ ...c, id: '' }))).toEqual(
    original.chairs.map((c: any) => ({ ...c, id: '' })),
  );
  for (let i = 0; i < 2; i++) expect(copy.chairs[i].id).not.toBe(original.chairs[i].id);
  await page.getByTitle('Undo edit').click();
  await expect(page.locator('[data-table-id]')).toHaveCount(1);
  await page.getByTitle('Redo (⌘⇧Z)', { exact: true }).click();
  await expect(page.locator('[data-table-id]')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('[data-table-id]')).toHaveCount(2);
});

test('table controls stay outside all chairs', async ({ page }) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await createOneTable(page);
  await page.getByRole('button', { name: 'Add selected tables (1)', exact: true }).click();
  for (let i = 0; i < 8; i++)
    await page.getByRole('button', { name: 'Add chair', exact: true }).click();
  const chairs = await page.locator('[data-chair-id]').all();
  for (const id of ['table-copy', 'table-add-chair', 'table-resize', 'table-rotate']) {
    const h = (await page.locator(`[data-handle="${id}"]`).boundingBox())!;
    for (const chair of chairs) {
      const c = (await chair.boundingBox())!;
      expect(
        h.x >= c.x + c.width ||
          h.x + h.width <= c.x ||
          h.y >= c.y + c.height ||
          h.y + h.height <= c.y,
      ).toBe(true);
    }
  }
  const copy = (await page.locator('[data-handle="table-copy"]').boundingBox())!,
    add = (await page.locator('[data-handle="table-add-chair"]').boundingBox())!;
  expect(add.y - (copy.y + copy.height)).toBeGreaterThan(5);
  await page.screenshot({ path: 'tests/spaced-table-controls.png' });
});

test('resize handle stays near table corner without touching chairs', async ({ page }) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await createOneTable(page);
  await page.getByRole('button', { name: 'Add selected tables (1)', exact: true }).click();
  for (let i = 0; i < 8; i++)
    await page.getByRole('button', { name: 'Add chair', exact: true }).click();
  await expect(page.locator('[data-handle="table-resize"]')).toHaveAttribute(
    'transform',
    'translate(88 50.5)',
  );
});

test('right panel creates directly on plan and canvas delete supports table and chair', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await page.getByRole('button', { name: 'Create table', exact: true }).click();
  await page.getByRole('combobox', { name: 'Shape', exact: true }).selectOption('circle');
  await page.getByRole('button', { name: 'Create & add to plan', exact: true }).click();
  await expect(page.locator('[data-table-id]')).toHaveCount(1);
  await expect(page.getByRole('combobox', { name: 'Table shape', exact: true })).toHaveValue(
    'circle',
  );
  await page.locator('[data-handle="table-add-chair"]').click();
  await page.locator('[data-chair-id]>g').first().click();
  await page.locator('[data-handle="chair-delete"]').click();
  await expect(page.locator('[data-chair-id]')).toHaveCount(0);
  await page.getByTitle('Undo edit').click();
  await expect(page.locator('[data-chair-id]')).toHaveCount(1);
  await page.locator('[data-table-id]').click();
  await page.locator('[data-handle="table-delete"]').click();
  await expect(page.locator('[data-table-id]')).toHaveCount(0);
  await expect(page.locator('[data-chair-id]')).toHaveCount(0);
  await page.getByTitle('Undo edit').click();
  await expect(page.locator('[data-table-id]')).toHaveCount(1);
  await expect(page.locator('[data-chair-id]')).toHaveCount(1);
});

test('three sofa shapes create render copy and persist', async ({ page }) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  for (const shape of ['sofa-straight', 'sofa-corner', 'sofa-semicircle']) {
    await page.getByRole('button', { name: 'Create table', exact: true }).click();
    await page.getByRole('textbox', { name: 'Name prefix', exact: true }).fill('Sofa');
    await page.getByRole('combobox', { name: 'Shape', exact: true }).selectOption(shape);
    await page.getByRole('button', { name: 'Create & add to plan', exact: true }).click();
    await expect(page.locator('[data-table-id].selected .sofa-geometry')).toHaveCount(1);
    await expect(page.locator('[data-handle="table-add-chair"]')).toHaveCount(0);
    await page.getByRole('button', { name: /Back to (tables|sofas)/ }).click();
  }
  await expect(page.locator('svg.canvas .sofa-geometry')).toHaveCount(3);
  await page.reload();
  await expect(page.locator('svg.canvas .sofa-geometry')).toHaveCount(3);
});

test('dragging a table clamps its full chair group inside the hall and separates delete from resize', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await createOneTable(page);
  await page.getByRole('button', { name: 'Add selected tables (1)', exact: true }).click();
  for (let i = 0; i < 4; i++)
    await page.getByRole('button', { name: 'Add chair', exact: true }).click();
  const table = page.locator('[data-table-id]');
  const b = (await table.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(1430, 990, { steps: 12 });
  await page.mouse.up();
  const room = (await page.locator('.room').boundingBox())!;
  for (const element of [table, ...(await page.locator('[data-chair-id]').all())]) {
    const r = (await element.boundingBox())!;
    expect(r.x).toBeGreaterThanOrEqual(room.x);
    expect(r.y).toBeGreaterThanOrEqual(room.y);
    expect(r.x + r.width).toBeLessThanOrEqual(room.x + room.width);
    expect(r.y + r.height).toBeLessThanOrEqual(room.y + room.height);
  }
  const trash = (await page.locator('[data-handle="table-delete"]').boundingBox())!,
    resize = (await page.locator('[data-handle="table-resize"]').boundingBox())!;
  expect(trash.y + trash.height).toBeLessThan(resize.y);
});

test('buttons beside Hall directly open table and sofa creation', async ({ page }) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name prefix', exact: true })).toHaveValue(
    'Table',
  );
  await page.getByRole('button', { name: 'Create & add to plan', exact: true }).click();
  await expect(page.locator('[data-table-id]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Add sofa', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Name prefix', exact: true })).toHaveValue('Sofa');
  const shape = page.getByRole('combobox', { name: 'Shape', exact: true });
  await expect(shape).toHaveValue('sofa-straight');
  await expect(shape.locator('option[value="sofa-corner"]')).toHaveText('L-shaped sofa');
  await shape.selectOption('sofa-circle');
  await page.getByRole('button', { name: 'Create & add to plan', exact: true }).click();
  await expect(page.locator('svg.canvas .sofa-geometry')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('[data-table-id]')).toHaveCount(2);
  await expect(page.locator('svg.canvas .sofa-geometry')).toHaveCount(1);
});

test('table and chair control icons remain upright on screen', async ({ page }) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await createOneTable(page);
  await page.getByRole('button', { name: 'Add selected tables (1)', exact: true }).click();
  await page.getByRole('button', { name: 'Add chair', exact: true }).click();
  const rotation = page.getByRole('spinbutton', { name: 'Rotation (°)', exact: true });
  await rotation.fill('45');
  await rotation.press('Enter');
  const upright = async () => {
    for (const icon of await page.locator('.handle-visual').all()) {
      const m = await icon.evaluate((el) => {
        const m = (el as SVGGraphicsElement).getCTM()!;
        return { b: m.b, c: m.c, a: m.a, d: m.d };
      });
      expect(m.b).toBeCloseTo(0);
      expect(m.c).toBeCloseTo(0);
      expect(m.a).toBeGreaterThan(0);
      expect(m.d).toBeGreaterThan(0);
    }
  };
  await upright();
  await page.locator('[data-chair-id]>g').first().click();
  await rotation.fill('90');
  await rotation.press('Enter');
  await upright();
});

test('selected controls render above overlapping furniture and stay close', async ({ page }) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await createOneTable(page);
  await page.getByRole('button', { name: 'Add selected tables (1)', exact: true }).click();
  await page.evaluate(() => {
    const key = 'floorplan-empty-v2',
      d = JSON.parse(localStorage.getItem(key)!);
    const original = d.tables[0];
    d.tables.push({
      ...original,
      id: 'overlapping-table',
      name: 'Overlap',
      width: 80,
      height: 80,
      x: original.x + original.width / 2 + 8,
      y: original.y + original.height / 2 + 8,
      chairs: [],
    });
    localStorage.setItem(key, JSON.stringify(d));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Tables', exact: true }).click();
  await page.getByRole('button', { name: 'Select tables', exact: true }).click();
  await page.locator('.placed-option').first().click();
  await page.getByRole('button', { name: 'Edit selected table', exact: true }).click();
  const handle = page.locator('[data-handle="table-resize"]'),
    b = (await handle.boundingBox())!;
  const top = await page.evaluate(
    ({ x, y }) =>
      document.elementFromPoint(x, y)?.closest('[data-handle]')?.getAttribute('data-handle'),
    { x: b.x + b.width / 2, y: b.y + b.height / 2 },
  );
  expect(top).toBe('table-resize');
  await expect(page.locator('svg.canvas>g').last()).toHaveAttribute('data-controls-layer', 'top');
  await expect(handle).toHaveAttribute('transform', 'translate(88 50.5)');
});

test('quick library directly inserts furniture and names are editable on canvas', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('button', { name: 'Create your first hall' }).click();
  await page.getByTitle('Close panel', { exact: true }).click();
  await page.getByRole('button', { name: 'Quick add straight sofa', exact: true }).click();
  await expect(page.locator('svg.canvas .sofa-geometry')).toHaveCount(1);
  await expect(page.locator('.quick-library')).toBeVisible();
  await page.locator('[data-table-id]').dblclick();
  const name = page.getByRole('textbox', { name: 'Furniture name', exact: true });
  await expect(name).toBeVisible();
  await name.fill('Window sofa');
  await name.press('Enter');
  await expect(page.locator('[data-table-id] text')).toContainText('Window sofa');
  await expect(page.getByRole('textbox', { name: 'Sofa name', exact: true })).toHaveValue(
    'Window sofa',
  );
  await page.getByTitle('Close panel', { exact: true }).click();
  await page.getByRole('button', { name: 'Quick add rectangle', exact: true }).click();
  await expect(page.locator('[data-table-id]')).toHaveCount(2);
  await page.getByRole('button', { name: 'Add sofa', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add sofa', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create sofa', exact: true })).toBeVisible();
});
