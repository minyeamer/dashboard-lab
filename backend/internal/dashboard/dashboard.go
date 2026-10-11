package dashboard

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

var ErrNotFound = errors.New("dashboard not found")

type ValidationError struct{ Message string }

func (e *ValidationError) Error() string { return e.Message }

type Panel struct {
	ID    string `json:"id"`
	Type  string `json:"type"`
	Title string `json:"title"`
	SQL   string `json:"sql"`
}

type Document struct {
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Panels      []Panel `json:"panels"`
}

func (d Document) Validate() error {
	invalid := func(message string) error { return &ValidationError{Message: message} }
	if strings.TrimSpace(d.Title) == "" || len([]rune(d.Title)) > 200 {
		return invalid("대시보드 제목은 1~200자로 입력해 주세요.")
	}
	if len([]rune(d.Description)) > 2000 {
		return invalid("설명은 2000자 이내로 입력해 주세요.")
	}
	if d.Panels == nil || len(d.Panels) > 20 {
		return invalid("panels는 최대 20개의 패널을 가진 배열이어야 합니다.")
	}
	ids := make(map[string]bool)
	for i, panel := range d.Panels {
		if strings.TrimSpace(panel.ID) == "" || len(panel.ID) > 100 || ids[panel.ID] {
			return invalid("패널 ID는 비어 있거나 중복될 수 없습니다.")
		}
		ids[panel.ID] = true
		if panel.Type != "table" {
			return invalid("현재는 table 패널만 지원합니다.")
		}
		if strings.TrimSpace(panel.Title) == "" || len([]rune(panel.Title)) > 200 {
			return invalid(fmt.Sprintf("%d번째 패널 제목은 1~200자로 입력해 주세요.", i+1))
		}
		if strings.TrimSpace(panel.SQL) == "" || len(panel.SQL) > 20000 {
			return invalid(fmt.Sprintf("%d번째 패널 SQL은 비어 있지 않고 20000바이트 이내여야 합니다.", i+1))
		}
	}
	return nil
}

type Dashboard struct {
	UID         string    `json:"uid"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	UpdatedAt   time.Time `json:"updatedAt"`
	Panels      []Panel   `json:"panels"`
}

type Store interface {
	List(context.Context) ([]Dashboard, error)
	GetByUID(context.Context, string) (Dashboard, error)
	Update(context.Context, string, Document) (Dashboard, error)
}

type PostgresStore struct {
	db *sql.DB
}

func NewPostgresStore(db *sql.DB) *PostgresStore {
	return &PostgresStore{db: db}
}

func (s *PostgresStore) List(ctx context.Context) ([]Dashboard, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT uid, title, description, updated_at, panels
		FROM dashboards
		ORDER BY updated_at DESC, uid ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	dashboards := make([]Dashboard, 0)
	for rows.Next() {
		var item Dashboard
		var panels []byte
		if err := rows.Scan(&item.UID, &item.Title, &item.Description, &item.UpdatedAt, &panels); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(panels, &item.Panels); err != nil {
			return nil, err
		}
		dashboards = append(dashboards, item)
	}

	return dashboards, rows.Err()
}

func (s *PostgresStore) GetByUID(ctx context.Context, uid string) (Dashboard, error) {
	var item Dashboard
	var panels []byte
	err := s.db.QueryRowContext(ctx, `
		SELECT uid, title, description, updated_at, panels
		FROM dashboards
		WHERE uid = $1
	`, uid).Scan(&item.UID, &item.Title, &item.Description, &item.UpdatedAt, &panels)
	if errors.Is(err, sql.ErrNoRows) {
		return Dashboard{}, ErrNotFound
	}

	if err != nil {
		return Dashboard{}, err
	}
	err = json.Unmarshal(panels, &item.Panels)
	return item, err
}

func (s *PostgresStore) Update(ctx context.Context, uid string, document Document) (Dashboard, error) {
	if err := document.Validate(); err != nil {
		return Dashboard{}, err
	}
	panels, err := json.Marshal(document.Panels)
	if err != nil {
		return Dashboard{}, err
	}
	item := Dashboard{UID: uid, Title: document.Title, Description: document.Description, Panels: document.Panels}
	err = s.db.QueryRowContext(ctx, `
		UPDATE dashboards SET title = $2, description = $3, panels = $4::jsonb, updated_at = now()
		WHERE uid = $1 RETURNING updated_at
	`, uid, document.Title, document.Description, string(panels)).Scan(&item.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Dashboard{}, ErrNotFound
	}
	return item, err
}
