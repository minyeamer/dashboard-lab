# dashboard-lab

Grafana의 공개된 대시보드 흐름을 작은 단위로 독립 재구현하는 개인 학습 프로젝트입니다. Grafana Labs와 관련되거나 Grafana와 호환되는 제품이 아닙니다.

## Phase 0 실행

1. `.env.example`을 `.env`로 복사합니다.
2. Docker Desktop을 실행합니다.
3. 저장소 루트에서 실행합니다.

```bash
docker compose up --build
```

* 프론트엔드: `http://localhost:5173`
* 백엔드 health API: `http://localhost:8080/api/health`
* 메타데이터 PostgreSQL: `localhost:15431`
* 분석 PostgreSQL: `localhost:15432`

`/dashboards`에서 메타데이터 DB에 저장된 대시보드 목록을 확인할 수 있습니다. 목록을 선택하면 `/d/:uid` 상세 화면으로 이동합니다.

분석 DB는 이 저장소에 포함된 `demo_db`를 읽기 전용으로 마운트해 초기화합니다. 따라서 저장소를 내려받은 사람도 별도 데이터 저장소 없이 동일한 데모 데이터를 사용할 수 있습니다.

컨테이너와 named volume을 제거하고 처음부터 초기화하려면 다음을 실행합니다.

```bash
docker compose down -v
```

## 현재 범위

대시보드 목록과 상세 조회 API를 제공합니다. SQL query, 패널, 인증은 이후 단계에서 추가합니다.
