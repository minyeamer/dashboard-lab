package main

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/minyeamer/dashboard-lab/backend/internal/dashboard"
)

type fakeDashboardStore struct {
	items []dashboard.Dashboard
}

func (s fakeDashboardStore) List(context.Context) ([]dashboard.Dashboard, error) {
	return s.items, nil
}

func (s fakeDashboardStore) GetByUID(_ context.Context, uid string) (dashboard.Dashboard, error) {
	for _, item := range s.items {
		if item.UID == uid {
			return item, nil
		}
	}
	return dashboard.Dashboard{}, dashboard.ErrNotFound
}

func TestHealth(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	res := httptest.NewRecorder()

	newHandler(fakeDashboardStore{}).ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}

	if got := res.Body.String(); got != "{\"status\":\"ok\"}\n" {
		t.Fatalf("unexpected body %q", got)
	}
}

func TestListDashboards(t *testing.T) {
	store := fakeDashboardStore{items: []dashboard.Dashboard{{
		UID: "sales-overview", Title: "매출 현황", UpdatedAt: time.Date(2026, 7, 31, 0, 0, 0, 0, time.UTC),
	}}}
	req := httptest.NewRequest(http.MethodGet, "/api/v1/dashboards", nil)
	res := httptest.NewRecorder()

	newHandler(store).ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}
	if got := res.Body.String(); !strings.Contains(got, "sales-overview") {
		t.Fatalf("expected dashboard UID in response, got %q", got)
	}
}

func TestGetDashboardReturnsNotFound(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/dashboards/unknown", nil)
	res := httptest.NewRecorder()

	newHandler(fakeDashboardStore{}).ServeHTTP(res, req)

	if res.Code != http.StatusNotFound {
		t.Fatalf("expected status %d, got %d", http.StatusNotFound, res.Code)
	}
	body, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(body), "dashboard not found") {
		t.Fatalf("unexpected body %q", body)
	}
}
