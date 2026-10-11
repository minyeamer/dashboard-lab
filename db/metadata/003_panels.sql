BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY
);

ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS panels jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(panels) = 'array');

UPDATE dashboards
SET panels = jsonb_build_array(jsonb_build_object(
    'id', 'daily-sales',
    'type', 'table',
    'title', '일별 매출과 영업이익',
    'sql', $query$SELECT
  order_date AS "날짜",
  SUM(payment_amount) AS "매출",
  SUM(profit) AS "영업이익"
FROM analytics.profit_daily(DATE '2026-07-01', DATE '2026-07-31')
GROUP BY order_date
ORDER BY order_date$query$
))
WHERE uid = 'sales-overview' AND panels = '[]'::jsonb
  AND NOT EXISTS (SELECT 1 FROM schema_migrations WHERE name = '003_panels');

INSERT INTO schema_migrations (name) VALUES ('003_panels') ON CONFLICT DO NOTHING;

COMMIT;
