export type Panel = { id: string; type: 'table'; title: string; sql: string };
export type DashboardDocument = { title: string; description: string; panels: Panel[] };
export type Dashboard = DashboardDocument & { uid: string; updatedAt: string };

export function toDocument(dashboard: DashboardDocument): DashboardDocument {
  return {
    title: dashboard.title,
    description: dashboard.description,
    panels: dashboard.panels.map(({ id, type, title, sql }) => ({ id, type, title, sql })),
  };
}

export function movePanel(panels: Panel[], id: string, offset: number): Panel[] {
  const from = panels.findIndex((panel) => panel.id === id);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= panels.length) return panels;
  const next = [...panels];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export const apiURL = import.meta.env.VITE_BACKEND_URL ?? '';

export async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? `요청 실패 (${response.status})`);
  }
  return response.json() as Promise<T>;
}
