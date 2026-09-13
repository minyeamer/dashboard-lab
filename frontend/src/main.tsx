import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css';

function App() {
  return (
    <main>
      <header>
        <p className="eyebrow">dashboard-lab · Phase 0</p>
        <h1>Dashboards</h1>
        <p>Grafana OSS의 공개된 흐름을 독립적으로 재구현하는 학습 환경입니다.</p>
      </header>
      <section aria-labelledby="empty-state-title" className="empty-state">
        <h2 id="empty-state-title">아직 대시보드가 없습니다</h2>
        <p>Phase 1에서 대시보드 목록과 `/d/:uid` 조회를 구현합니다.</p>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

