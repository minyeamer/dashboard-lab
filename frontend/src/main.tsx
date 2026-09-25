import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css';

type Dashboard = { uid: string; title: string; description: string; updatedAt: string };
type TableFrame = { fields: TableField[]; rows: unknown[][] };
type TableField = { name: string; type: 'number' | 'string' | 'time' };
type SortDirection = 'asc' | 'desc';
type SortState = { columnIndex: number; direction: SortDirection };

const apiURL = import.meta.env.VITE_BACKEND_URL ?? '';
const dailySalesQuery = `SELECT
  order_date AS "날짜",
  SUM(payment_amount) AS "매출",
  SUM(profit) AS "영업이익"
FROM analytics.profit_daily(DATE '2026-07-01', DATE '2026-07-31')
GROUP BY order_date
ORDER BY order_date`;

function App() {
  const detailUID = window.location.pathname.match(/^\/d\/([^/]+)$/)?.[1];
  return detailUID ? <DashboardDetail uid={detailUID} /> : <DashboardList />;
}

function DashboardList() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [error, setError] = useState<string>();
  useEffect(() => {
    fetch(`${apiURL}/api/v1/dashboards`)
      .then((response) => {
        if (!response.ok) throw new Error('대시보드 목록을 불러오지 못했습니다.');
        return response.json() as Promise<Dashboard[]>;
      })
      .then(setDashboards)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : '알 수 없는 오류가 발생했습니다.'));
  }, []);
  return <main>
    <header><p className="eyebrow">dashboard-lab</p><h1>Dashboards</h1><p>Grafana의 공개된 대시보드 흐름을 독립적으로 재구현하는 학습 환경입니다.</p></header>
    {error ? <p className="error-message">{error}</p> : null}
    <section aria-label="대시보드 목록" className="dashboard-list">
      {dashboards.map((dashboard) => <a className="dashboard-card" href={`/d/${dashboard.uid}`} key={dashboard.uid}>
        <h2>{dashboard.title}</h2><p>{dashboard.description}</p><span>최근 수정 {new Date(dashboard.updatedAt).toLocaleDateString('ko-KR')}</span>
      </a>)}
    </section>
  </main>;
}

function DashboardDetail({ uid }: { uid: string }) {
  const [dashboard, setDashboard] = useState<Dashboard>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    fetch(`${apiURL}/api/v1/dashboards/${uid}`)
      .then((response) => {
        if (!response.ok) throw new Error('대시보드를 불러오지 못했습니다.');
        return response.json() as Promise<Dashboard>;
      })
      .then(setDashboard)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : '알 수 없는 오류가 발생했습니다.'));
  }, [uid]);
  return <main>
    <a className="back-link" href="/dashboards">← Dashboards</a>
    {error ? <p className="error-message">{error}</p> : null}
    {dashboard ? <>
      <section className="dashboard-detail"><p className="eyebrow">{dashboard.uid}</p><h1>{dashboard.title}</h1><p>{dashboard.description}</p></section>
      {uid === 'sales-overview' ? <DailySalesTable /> : <section className="panel empty-panel-state"><p>패널과 차트는 이후 단계에서 이 화면에 추가합니다.</p></section>}
    </> : null}
  </main>;
}

function DailySalesTable() {
  const [frame, setFrame] = useState<TableFrame>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    fetch(`${apiURL}/api/v1/query`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sql: dailySalesQuery }) })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => undefined) as { message?: string } | undefined;
          throw new Error(body?.message ?? '표 데이터를 불러오지 못했습니다.');
        }
        return response.json() as Promise<TableFrame>;
      })
      .then(setFrame)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : '알 수 없는 오류가 발생했습니다.'));
  }, []);
  return <section aria-labelledby="daily-sales-panel-title" className="panel">
    <div className="panel-heading"><div><p className="eyebrow">Table</p><h2 id="daily-sales-panel-title">일별 매출과 영업이익</h2></div><span>2026. 7. 1. - 2026. 7. 31.</span></div>
    {error ? <p className="error-message">{error}</p> : null}
    {!frame && !error ? <p className="muted">표 데이터를 불러오는 중입니다.</p> : null}
    {frame && frame.rows.length === 0 ? <p className="muted">조회된 데이터가 없습니다.</p> : null}
    {frame && frame.rows.length > 0 ? <Table frame={frame} /> : null}
  </section>;
}

function Table({ frame }: { frame: TableFrame }) {
  const [sort, setSort] = useState<SortState>();
  const [page, setPage] = useState(0);
  const totals = calculateTotals(frame);
  const rows = sortRows(frame, sort);
  const pageSize = 10;
  const pageCount = Math.ceil(rows.length / pageSize);
  const visibleRows = rows.slice(page * pageSize, (page + 1) * pageSize);
  function changeSort(columnIndex: number) {
    setPage(0);
    setSort((current) => {
      if (current?.columnIndex !== columnIndex) return { columnIndex, direction: 'desc' };
      if (current.direction === 'desc') return { columnIndex, direction: 'asc' };
      return undefined;
    });
  }
  return <div className="table-scroll"><table>
    <thead><tr>{frame.fields.map((field, columnIndex) => <th aria-sort={sortAriaValue(sort, columnIndex)} className={field.type === 'number' ? 'numeric-cell' : undefined} key={field.name}>
      <button className="sort-button" onClick={() => changeSort(columnIndex)} type="button">{field.name}<SortIndicator sort={sort} columnIndex={columnIndex} /></button>
    </th>)}</tr></thead>
    <tbody>{visibleRows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((value, columnIndex) =>
      <td className={cellClassName(frame.fields[columnIndex])} key={`${rowIndex}-${columnIndex}`}>{formatCell(value, frame.fields[columnIndex])}</td>)}</tr>)}</tbody>
    <tfoot><tr>{frame.fields.map((field, columnIndex) =>
      <td className={columnIndex === 0 ? 'total-label' : 'numeric-cell'} key={field.name}>{columnIndex === 0 ? '합계' : formatCell(totals[columnIndex], field)}</td>)}</tr></tfoot>
  </table><div className="table-pagination"><span>{`${page * pageSize + 1}-${Math.min((page + 1) * pageSize, rows.length)} / ${rows.length}행`}</span><div>
    <button aria-label="이전 페이지" disabled={page === 0} onClick={() => setPage((current) => current - 1)} type="button">이전</button>
    <button aria-label="다음 페이지" disabled={page >= pageCount - 1} onClick={() => setPage((current) => current + 1)} type="button">다음</button>
  </div></div></div>;
}

function calculateTotals(frame: TableFrame) {
  return frame.fields.map((field, index) => frame.rows.reduce((total, row) => {
    const value = String(row[index]);
    return field.type === 'number' && isNumeric(value) ? total + Number(value) : total;
  }, 0));
}
function sortRows(frame: TableFrame, sort: SortState | undefined) {
  if (!sort) return frame.rows;
  const field = frame.fields[sort.columnIndex];
  return [...frame.rows].sort((left, right) => {
    const leftValue = sortValue(left[sort.columnIndex], field.type);
    const rightValue = sortValue(right[sort.columnIndex], field.type);
    const result = leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
    return sort.direction === 'asc' ? result : -result;
  });
}
function sortValue(value: unknown, type: TableField['type']) { return type === 'number' ? Number(value) : String(value); }
function sortAriaValue(sort: SortState | undefined, index: number) { if (sort?.columnIndex !== index) return 'none'; return sort.direction === 'asc' ? 'ascending' : 'descending'; }
function SortIndicator({ sort, columnIndex }: { sort: SortState | undefined; columnIndex: number }) { return <span aria-hidden="true" className="sort-indicator">{sort?.columnIndex !== columnIndex ? '↕' : sort.direction === 'asc' ? '↑' : '↓'}</span>; }
function formatCell(value: unknown, field: TableField) {
  if (value === null) return '-';
  const text = String(value);
  if (field.type === 'time' && isISODate(text)) return text.slice(0, 10);
  if (field.type === 'number' && isNumeric(text)) return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(Number(text));
  return text;
}
function cellClassName(field: TableField) { return field.type === 'number' ? 'numeric-cell' : undefined; }
function isISODate(value: string) { return /^\d{4}-\d{2}-\d{2}T/.test(value); }
function isNumeric(value: string) { return /^-?\d+(?:\.\d+)?$/.test(value); }

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
