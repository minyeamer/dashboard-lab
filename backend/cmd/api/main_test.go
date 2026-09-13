package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealth(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	res := httptest.NewRecorder()

	health(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}

	if got := res.Body.String(); got != "{\"status\":\"ok\",\"phase\":\"0\"}\n" {
		t.Fatalf("unexpected body %q", got)
	}
}
