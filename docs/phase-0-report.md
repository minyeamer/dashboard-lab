# Phase 0 보고서 — 관찰 환경과 빈 애플리케이션

## 이번 Phase의 목표

Grafana의 특정 기능을 아직 복제하지 않는다. 이후 각 기능을 관찰·구현·테스트할 수 있도록 다음 환경을 만든다.

* 독립적인 `dashboard-lab` 저장소
* 앱의 설정을 저장할 메타데이터 PostgreSQL
* 매출/영업이익 SQL을 실행할 분석 PostgreSQL
* Go HTTP API의 최소 health endpoint
* React의 정적 대시보드 목록 화면

## 만든 구조

```text
브라우저 (React, localhost:5173)
            │
            └── Go API (localhost:8080)

메타데이터 DB (localhost:15431)
  └── 이후: 사용자, dashboard, datasource, 권한, version

분석 DB (localhost:15432)
  └── profit-agent-demo/demo_db를 read-only mount로 초기화
      └── analytics.profit_daily(start_date, end_date)
```

분석 DB의 초기화 입력은 저장소에 포함된 `demo_db`다. Compose는 이를 PostgreSQL 초기화 디렉터리에 읽기 전용으로 마운트한다. 따라서 외부 저장소나 로컬 절대 경로에 의존하지 않는다.

## Grafana에서 관찰할 첫 경로

다음 Phase부터는 기능을 하나씩 관찰한다.

1. Grafana의 dashboard 목록을 연다.
2. dashboard 하나를 열고 URL `/d/:uid`를 기록한다.
3. Network 탭에서 dashboard 정의를 가져오는 요청을 기록한다.
4. PostgreSQL panel을 추가하고 `POST /api/ds/query` 요청과 응답을 기록한다.

관련 소스의 출발점은 `public/app/routes/routes.tsx`, `pkg/api/api.go`, `pkg/api/ds_query.go`다. 이 파일들을 미리 모두 읽을 필요는 없다.

## 의도적인 제한

* Phase 0의 API는 `/api/health`만 제공한다. dashboard API는 Phase 1에서 만든다.
* 프론트엔드는 빈 목록 화면만 제공한다. Grafana의 CSS나 자산을 복사하지 않았다.
* 백엔드는 아직 DB에 연결하지 않는다. 메타데이터 schema는 이후 migration의 출발점만 만든다.

## 실행 방법

```bash
cp .env.example .env
docker compose up --build
```

정상일 때 아래 주소를 확인한다.

* `http://localhost:5173`
* `http://localhost:8080/api/health` → `{"status":"ok","phase":"0"}`

## 검증 결과

* `docker compose --env-file .env.example config --quiet`로 Compose 설정을 검증했다.
* `npm run build`로 React/TypeScript production build를 검증했다.
* `GOWORK=off go test ./...`로 Go health handler 테스트를 통과했다. `GOWORK=off`는 상위 Grafana 저장소의 Go workspace 설정을 이 독립 모듈이 상속하지 않도록 하기 위한 설정이다.
* `docker compose --env-file .env.example up --build -d`로 네 컨테이너를 실제 기동했다. 두 PostgreSQL 컨테이너는 healthy 상태가 됐고, backend와 frontend도 실행 중이다.
* `GET http://localhost:8080/api/health`는 `{"status":"ok","phase":"0"}`을 반환했다.
* `http://localhost:5173`은 `dashboard-lab` HTML 문서를 반환했다.
* 분석 DB에서 `demo.sales_daily`는 39,684건, `analytics.profit_daily('2026-07-01', '2026-07-31')`는 2,948건을 반환했다.
* `demo_db`를 저장소에 포함하도록 변경한 뒤 analytics-db 컨테이너를 재생성했고, 컨테이너의 초기화 mount가 이 저장소의 `demo_db`를 가리키는 것을 확인했다.

## 다음 Phase

Phase 1은 `GET /api/v1/dashboards`와 `GET /api/v1/dashboards/:uid`를 구현하고, `/dashboards` 목록과 `/d/:uid` 상세 페이지를 연결한다. 먼저 Grafana dashboard 목록과 상세 페이지의 Network 요청을 관찰한다.
