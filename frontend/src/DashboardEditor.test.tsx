// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardDetail, PanelEditor } from './DashboardEditor';
import { movePanel, toDocument, type Panel } from './dashboard';

const panel: Panel = { id: 'one', type: 'table', title: 'Original', sql: 'SELECT 1' };
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, options) => {
    if (options?.method === 'POST') return Promise.resolve(new Response(JSON.stringify({ fields: [], rows: [] })));
    if (options?.method === 'PUT') return Promise.resolve(new Response(JSON.stringify({ message: '서버 검증 오류' }), { status: 400 }));
    return Promise.resolve(new Response(JSON.stringify({ uid: 'example', title: 'Example', description: '', panels: [panel], updatedAt: '' })));
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('isolates draft objects and preserves IDs when reordering', () => {
  const original = { title: 'Example', description: '', panels: [panel, { ...panel, id: 'two' }] };
  const draft = toDocument(original);
  draft.panels[0].title = 'Changed';
  expect(original.panels[0].title).toBe('Original');
  expect(movePanel(draft.panels, 'two', -1).map((p) => p.id)).toEqual(['two', 'one']);
  expect(draft.panels.map((p) => p.id)).toEqual(['one', 'two']);
});

it('runs SQL only on Run query and applies without saving', async () => {
  const user = userEvent.setup();
  const apply = vi.fn();
  render(<PanelEditor panel={panel} onApply={apply} onCancel={vi.fn()} />);
  await screen.findByText('조회된 데이터가 없습니다.');
  const calls = vi.mocked(fetch).mock.calls.length;
  await user.clear(screen.getByLabelText('SQL'));
  await user.type(screen.getByLabelText('SQL'), 'SELECT 2');
  expect(vi.mocked(fetch).mock.calls.length).toBe(calls);
  await user.click(screen.getByRole('button', { name: 'Run query' }));
  await waitFor(() => expect(vi.mocked(fetch).mock.calls.length).toBe(calls + 1));
  await user.click(screen.getByRole('button', { name: 'Apply' }));
  expect(apply).toHaveBeenCalledWith({ ...panel, sql: 'SELECT 2' });
  expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
});

it('discards applied panel edits without touching the saved dashboard', async () => {
  const user = userEvent.setup();
  render(<DashboardDetail uid="example" />);
  await user.click(await screen.findByRole('button', { name: 'Edit' }));
  await user.click(screen.getByRole('button', { name: 'Edit panel' }));
  await user.clear(screen.getByLabelText('Panel title'));
  await user.type(screen.getByLabelText('Panel title'), 'Changed');
  await user.click(screen.getByRole('button', { name: 'Apply' }));
  expect(screen.getByRole('heading', { name: 'Changed' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Exit edit' }));
  await user.click(screen.getByRole('button', { name: 'Discard' }));
  expect(screen.getByRole('heading', { name: 'Original' })).toBeTruthy();
});

it('retains inputs and reports server validation errors on failed save', async () => {
  const user = userEvent.setup();
  render(<DashboardDetail uid="example" />);
  await user.click(await screen.findByRole('button', { name: 'Edit' }));
  await user.click(screen.getByRole('button', { name: 'Save dashboard' }));
  await user.clear(screen.getByLabelText('Title', { exact: true }));
  await user.type(screen.getByLabelText('Title', { exact: true }), 'New title');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', '서버 검증 오류');
  expect(screen.getByLabelText('Title', { exact: true })).toHaveProperty('value', 'New title');
});
