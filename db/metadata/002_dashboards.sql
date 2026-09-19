CREATE TABLE IF NOT EXISTS dashboards (
    uid text PRIMARY KEY,
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO dashboards (uid, title, description, created_at, updated_at)
VALUES
    ('sales-overview', '매출 현황', '일별 매출과 영업이익을 살펴볼 대시보드입니다.', '2026-07-31 09:00:00+09', '2026-07-31 09:00:00+09'),
    ('brand-performance', '브랜드별 성과', '브랜드별 매출과 이익을 비교할 대시보드입니다.', '2026-07-30 09:00:00+09', '2026-07-30 09:00:00+09'),
    ('channel-performance', '쇼핑몰별 성과', '쇼핑몰별 판매 성과를 확인할 대시보드입니다.', '2026-07-29 09:00:00+09', '2026-07-29 09:00:00+09')
ON CONFLICT (uid) DO UPDATE
SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    updated_at = EXCLUDED.updated_at;
