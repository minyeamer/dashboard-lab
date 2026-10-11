import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css';
import { DashboardDetail } from './DashboardEditor';
import { apiURL, type Dashboard } from './dashboard';

function App() {
  const detailUID = window.location.pathname.match(/^\/d\/([^/]+)$/)?.[1];

  if (detailUID) {
    return <DashboardDetail uid={detailUID} />;
  }

  return <DashboardList />;
}

function DashboardList() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    fetch(`${apiURL}/api/v1/dashboards`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('대시보드 목록을 불러오지 못했습니다.');
        }
        return response.json() as Promise<Dashboard[]>;
      })
      .then(setDashboards)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : '알 수 없는 오류가 발생했습니다.'));
  }, []);

  return (
    <main>
      <header>
        <p className="eyebrow">dashboard-lab</p>
        <h1>Dashboards</h1>
        <p>Grafana의 공개된 대시보드 흐름을 독립적으로 재구현하는 학습 환경입니다.</p>
      </header>
      {error ? <p className="error-message">{error}</p> : null}
      <section aria-label="대시보드 목록" className="dashboard-list">
        {dashboards.map((dashboard) => (
          <a className="dashboard-card" href={`/d/${dashboard.uid}`} key={dashboard.uid}>
            <h2>{dashboard.title}</h2>
            <p>{dashboard.description}</p>
            <span>최근 수정 {new Date(dashboard.updatedAt).toLocaleDateString('ko-KR')}</span>
          </a>
        ))}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
