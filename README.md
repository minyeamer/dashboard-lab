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

`/dashboards`에서 메타데이터 DB에 저장된 대시보드 목록을 확인할 수 있습니다. 목록을 선택하면 `/d/:uid` 상세 화면으로 이동합니다. `sales-overview`에는 분석 DB의 일별 매출과 영업이익을 조회하는 표 패널이 포함됩니다.

분석 DB는 이 저장소에 포함된 `demo_db`를 읽기 전용으로 마운트해 초기화합니다. 따라서 저장소를 내려받은 사람도 별도 데이터 저장소 없이 동일한 데모 데이터를 사용할 수 있습니다.

컨테이너와 named volume을 제거하고 처음부터 초기화하려면 다음을 실행합니다.

```bash
docker compose down -v
```

## PostgreSQL 버전

메타데이터·분석 DB는 `postgres:17-alpine`과 17 전용 볼륨을 사용합니다. 기존 16 데이터는 전체 백업 후 복원했으며, 원본 볼륨 `dashboard-lab_metadata-db-data`, `dashboard-lab_analytics-db-data`는 롤백용으로 보존합니다. 이번 업그레이드의 백업과 데이터 검증 결과는 `.backups/postgres-16-to-17-20261011/`에 있습니다. 이 폴더는 Git에 포함하지 않습니다.

다른 환경에서 기존 16 데이터를 유지하려면 새 17 볼륨에 백업을 복원해야 합니다. 이미지 태그만 변경하거나 `docker compose down -v`로 데이터를 삭제하지 마세요.

## 현재 범위

대시보드 목록과 상세 조회, 읽기 전용 SQL 조회, Table 패널, 대시보드 편집과 저장을 제공합니다. 인증, 버전 충돌 처리, 차트는 이후 단계에서 추가합니다.

## 편집과 저장

`Edit`에서 패널을 추가하거나 제목과 SQL을 수정하고, 화살표로 순서를 변경할 수 있습니다. `Run query`는 미리보기, `Apply`는 편집 중인 문서에 적용, `Save dashboard`는 DB 저장입니다. 저장하지 않은 변경은 `Exit edit`의 `Discard`로 되돌립니다.

기존 메타데이터 볼륨을 사용하는 경우 다음 마이그레이션을 한 번 적용합니다. 새 볼륨은 시작할 때 자동 적용됩니다. 초기화 목적으로 기존 볼륨을 삭제할 필요는 없습니다.

```bash
docker compose exec -T metadata-db psql -U dashboard_lab -d dashboard_lab -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/003_panels.sql
docker compose up --build -d
```

마이그레이션을 다시 실행해도 사용자가 저장하거나 삭제한 패널을 초기 샘플로 덮어쓰지 않습니다.

```bash
cd backend
GOWORK=off go test ./...
```

```bash
cd frontend
npm ci
npm test
npm run build
```

Grafana의 편집 전 상태 보관, 패널 편집, 별도 대시보드 저장 흐름을 참고했습니다. 레이아웃 드래그 대신 순서 버튼, 복수 데이터소스 대신 PostgreSQL 하나, 시각화는 Table만 지원합니다. 저장 API는 학습용 PUT API이며 Grafana API와 호환되지 않습니다. 인증이 없는 로컬 학습 환경이므로 외부에 공개하지 않습니다.
