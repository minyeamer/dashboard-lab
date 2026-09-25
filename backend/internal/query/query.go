package query

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
)

const rowLimit = 100

var ErrInvalidStatement = errors.New("only SELECT statements are allowed")

type TableFrame struct {
	Fields []Field `json:"fields"`
	Rows   [][]any `json:"rows"`
}

type Field struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type Runner interface {
	Query(context.Context, string) (TableFrame, error)
}

type PostgresRunner struct {
	db *sql.DB
}

func NewPostgresRunner(db *sql.DB) *PostgresRunner {
	return &PostgresRunner{db: db}
}

func (r *PostgresRunner) Query(ctx context.Context, statement string) (TableFrame, error) {
	statement = normalizeStatement(statement)
	if !isReadOnlyStatement(statement) {
		return TableFrame{}, ErrInvalidStatement
	}

	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return TableFrame{}, err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, "SET LOCAL statement_timeout = '3000ms'"); err != nil {
		return TableFrame{}, err
	}

	rows, err := tx.QueryContext(ctx, "SELECT * FROM ("+statement+") AS dashboard_lab_query LIMIT 100")
	if err != nil {
		return TableFrame{}, err
	}
	defer rows.Close()

	columnTypes, err := rows.ColumnTypes()
	if err != nil {
		return TableFrame{}, err
	}
	fields := make([]Field, len(columnTypes))
	for index, column := range columnTypes {
		fields[index] = Field{Name: column.Name(), Type: fieldType(column.DatabaseTypeName())}
	}

	frame := TableFrame{Fields: fields, Rows: make([][]any, 0)}
	for rows.Next() {
		values := make([]any, len(fields))
		pointers := make([]any, len(fields))
		for i := range values {
			pointers[i] = &values[i]
		}
		if err := rows.Scan(pointers...); err != nil {
			return TableFrame{}, err
		}
		frame.Rows = append(frame.Rows, values)
	}

	if err := rows.Err(); err != nil {
		return TableFrame{}, err
	}
	if err := tx.Commit(); err != nil {
		return TableFrame{}, err
	}

	return frame, nil
}

func fieldType(databaseType string) string {
	switch strings.ToUpper(databaseType) {
	case "INT2", "INT4", "INT8", "FLOAT4", "FLOAT8", "NUMERIC", "DECIMAL":
		return "number"
	case "DATE", "TIMESTAMP", "TIMESTAMPTZ":
		return "time"
	default:
		return "string"
	}
}

func isReadOnlyStatement(statement string) bool {
	if strings.Contains(statement, ";") {
		return false
	}

	keywords := strings.Fields(statement)
	if len(keywords) == 0 {
		return false
	}

	switch strings.ToLower(keywords[0]) {
	case "select", "with":
		return true
	default:
		return false
	}
}

func normalizeStatement(statement string) string {
	statement = strings.TrimSpace(statement)
	statement = strings.TrimSuffix(statement, ";")
	return strings.TrimSpace(statement)
}

func FormatError(err error) string {
	if errors.Is(err, ErrInvalidStatement) {
		return err.Error()
	}
	return fmt.Sprintf("query failed: %v", err)
}

func IsTimeout(err error) bool {
	var postgresError *pgconn.PgError
	return errors.As(err, &postgresError) && postgresError.Code == "57014"
}
