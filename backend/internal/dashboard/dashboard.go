package dashboard

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

var ErrNotFound = errors.New("dashboard not found")

type Dashboard struct {
	UID         string    `json:"uid"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type Store interface {
	List(context.Context) ([]Dashboard, error)
	GetByUID(context.Context, string) (Dashboard, error)
}

type PostgresStore struct {
	db *sql.DB
}

func NewPostgresStore(db *sql.DB) *PostgresStore {
	return &PostgresStore{db: db}
}

func (s *PostgresStore) List(ctx context.Context) ([]Dashboard, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT uid, title, description, updated_at
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
		if err := rows.Scan(&item.UID, &item.Title, &item.Description, &item.UpdatedAt); err != nil {
			return nil, err
		}
		dashboards = append(dashboards, item)
	}

	return dashboards, rows.Err()
}

func (s *PostgresStore) GetByUID(ctx context.Context, uid string) (Dashboard, error) {
	var item Dashboard
	err := s.db.QueryRowContext(ctx, `
		SELECT uid, title, description, updated_at
		FROM dashboards
		WHERE uid = $1
	`, uid).Scan(&item.UID, &item.Title, &item.Description, &item.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Dashboard{}, ErrNotFound
	}

	return item, err
}
