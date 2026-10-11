import { useEffect, useState } from 'react';
import { apiURL } from './dashboard';

type TableFrame = {
  fields: TableField[];
  rows: unknown[][];
};

type TableField = {
  name: string;
  type: 'number' | 'string' | 'time';
};

type SortDirection = 'asc' | 'desc';

type SortState = {
  columnIndex: number;
  direction: SortDirection;
};

export function PanelData({ sql }: { sql: string }) {
  const [frame, setFrame] = useState<TableFrame>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    setFrame(undefined);
    setError(undefined);
    fetch(`${apiURL}/api/v1/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => undefined);
          throw new Error(body?.message ?? '표 데이터를 불러오지 못했습니다.');
        }
        return response.json() as Promise<TableFrame>;
      })
      .then((value) => { if (!controller.signal.aborted) setFrame(value); })
      .catch((reason: Error) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [sql]);

  if (error) return <p role="alert" className="error-message">{error}</p>;
  if (!frame) return <p role="status" className="muted">표 데이터를 불러오는 중입니다.</p>;
  if (!frame.rows.length) return <p className="muted">조회된 데이터가 없습니다.</p>;
  return <Table frame={frame} />;
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
      if (current?.columnIndex !== columnIndex) {
        return { columnIndex, direction: 'desc' };
      }
      if (current.direction === 'desc') {
        return { columnIndex, direction: 'asc' };
      }
      return undefined;
    });
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {frame.fields.map((field, columnIndex) => (
              <th aria-sort={sortAriaValue(sort, columnIndex)} className={field.type === 'number' ? 'numeric-cell' : undefined} key={field.name}>
                <button className="sort-button" onClick={() => changeSort(columnIndex)} type="button">
                  {field.name}<SortIndicator sort={sort} columnIndex={columnIndex} />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((value, columnIndex) => (
                <td className={cellClassName(frame.fields[columnIndex])} key={`${rowIndex}-${columnIndex}`}>
                  {formatCell(value, frame.fields[columnIndex])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            {frame.fields.map((field, columnIndex) => (
              <td className={columnIndex === 0 ? 'total-label' : 'numeric-cell'} key={field.name}>
                {columnIndex === 0 ? '합계' : formatCell(totals[columnIndex], field)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      <div className="table-pagination">
        <span>{rows.length === 0 ? '0' : `${page * pageSize + 1}-${Math.min((page + 1) * pageSize, rows.length)}`} / {rows.length}행</span>
        <div>
          <button aria-label="이전 페이지" disabled={page === 0} onClick={() => setPage((current) => current - 1)} type="button">이전</button>
          <button aria-label="다음 페이지" disabled={page >= pageCount - 1} onClick={() => setPage((current) => current + 1)} type="button">다음</button>
        </div>
      </div>
    </div>
  );
}

function calculateTotals(frame: TableFrame) {
  return frame.fields.map((field, columnIndex) => frame.rows.reduce((total, row) => {
    const value = String(row[columnIndex]);
    return field.type === 'number' && isNumeric(value) ? total + Number(value) : total;
  }, 0));
}

function sortRows(frame: TableFrame, sort: SortState | undefined) {
  if (!sort) {
    return frame.rows;
  }

  const field = frame.fields[sort.columnIndex];
  return [...frame.rows].sort((left, right) => {
    const leftValue = sortValue(left[sort.columnIndex], field.type);
    const rightValue = sortValue(right[sort.columnIndex], field.type);
    const result = leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
    return sort.direction === 'asc' ? result : -result;
  });
}

function sortValue(value: unknown, type: TableField['type']) {
  if (type === 'number') {
    return Number(value);
  }
  return String(value);
}

function sortAriaValue(sort: SortState | undefined, columnIndex: number) {
  if (sort?.columnIndex !== columnIndex) {
    return 'none';
  }
  return sort.direction === 'asc' ? 'ascending' : 'descending';
}

function SortIndicator({ sort, columnIndex }: { sort: SortState | undefined; columnIndex: number }) {
  if (sort?.columnIndex !== columnIndex) {
    return <span aria-hidden="true" className="sort-indicator">↕</span>;
  }
  return <span aria-hidden="true" className="sort-indicator">{sort.direction === 'asc' ? '↑' : '↓'}</span>;
}

function formatCell(value: unknown, field: TableField) {
  if (value === null) {
    return '-';
  }

  const text = String(value);
  if (field.type === 'time' && isISODate(text)) {
    return text.slice(0, 10);
  }
  if (field.type === 'number' && isNumeric(text)) {
    return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(Number(text));
  }
  return text;
}

function cellClassName(field: TableField) {
  return field.type === 'number' ? 'numeric-cell' : undefined;
}

function isISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}T/.test(value);
}

function isNumeric(value: string) {
  return /^-?\d+(?:\.\d+)?$/.test(value);
}
