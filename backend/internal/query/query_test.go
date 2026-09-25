package query

import (
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestPostgresRunnerRejectsNonSelectStatements(t *testing.T) {
	runner := NewPostgresRunner(nil)

	_, err := runner.Query(t.Context(), "DELETE FROM items")

	if err != ErrInvalidStatement {
		t.Fatalf("expected ErrInvalidStatement, got %v", err)
	}
}

func TestIsTimeout(t *testing.T) {
	if !IsTimeout(&pgconn.PgError{Code: "57014"}) {
		t.Fatal("expected PostgreSQL query cancellation to be a timeout")
	}
	if IsTimeout(errors.New("other error")) {
		t.Fatal("expected a normal error not to be a timeout")
	}
}

func TestPostgresRunnerAcceptsSelectAndWithStatements(t *testing.T) {
	for _, statement := range []string{
		"SELECT id FROM items",
		"SELECT id FROM items;",
		"SELECT\n  id\nFROM items",
		"WITH recent AS (SELECT id FROM items) SELECT id FROM recent",
	} {
		if !isReadOnlyStatement(normalizeStatement(statement)) {
			t.Fatalf("expected statement to be accepted: %s", statement)
		}
	}
}

func TestFieldType(t *testing.T) {
	tests := map[string]string{
		"NUMERIC":     "number",
		"TIMESTAMPTZ": "time",
		"TEXT":        "string",
	}

	for databaseType, expected := range tests {
		if actual := fieldType(databaseType); actual != expected {
			t.Fatalf("fieldType(%q) = %q, want %q", databaseType, actual, expected)
		}
	}
}
