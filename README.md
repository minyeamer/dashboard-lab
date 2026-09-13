# dashboard-lab

Grafana OSS의 공개된 대시보드 흐름을 작은 단위로 독립 재구현하는 개인 학습 프로젝트입니다. Grafana Labs와 관련되거나 Grafana와 호환되는 제품이 아닙니다.

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

분석 DB는 이 저장소에 포함된 `demo_db`를 읽기 전용으로 마운트해 초기화합니다. 따라서 저장소를 내려받은 사람도 별도 데이터 저장소 없이 동일한 데모 데이터를 사용할 수 있습니다.

컨테이너와 named volume을 제거하고 처음부터 초기화하려면 다음을 실행합니다.

```bash
docker compose down -v
```

## 현재 범위

Phase 0은 개발 환경과 정적 화면만 제공합니다. Dashboard API, SQL query, 인증은 이후 phase에서 추가합니다.
