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
	"github.com/minyeamer/dashboard-lab/backend/internal/query"
)

type fakeDashboardStore struct {
	items []dashboard.Dashboard
}

type fakeQueryRunner struct {
	frame query.TableFrame
	err   error
}

func (r fakeQueryRunner) Query(context.Context, string) (query.TableFrame, error) {
	return r.frame, r.err
}

func (s fakeDashboardStore) List(context.Context) ([]dashboard.Dashboard, error) {
	return s.items, nil
}

func (s fakeDashboardStore) Update(_ context.Context, uid string, d dashboard.Document) (dashboard.Dashboard, error) {
	for _, item := range s.items {
		if item.UID == uid {
			item.Title = d.Title
			item.Description = d.Description
			item.Panels = d.Panels
			return item, nil
		}
	}
	return dashboard.Dashboard{}, dashboard.ErrNotFound
}

func TestUpdateDashboard(t *testing.T) {
	cases := []struct {
		name, uid, body string
		status          int
	}{
		{"save", "example", `{"title":"Updated","description":"","panels":[{"id":"p1","type":"table","title":"Panel","sql":"SELECT 1"}]}`, 200},
		{"empty panels", "example", `{"title":"Updated","description":"","panels":[]}`, 200},
		{"missing", "missing", `{"title":"Updated","panels":[]}`, 404},
		{"blank title", "example", `{"title":"  ","panels":[]}`, 400},
		{"null panels", "example", `{"title":"Updated","panels":null}`, 400},
		{"unknown property", "example", `{"title":"Updated","panels":[],"uid":"other"}`, 400},
		{"multiple documents", "example", `{"title":"Updated","panels":[]} {}`, 400},
		{"malformed", "example", `{`, 400},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			store := fakeDashboardStore{items: []dashboard.Dashboard{{UID: "example"}}}
			res := httptest.NewRecorder()
			newHandler(store, fakeQueryRunner{}).ServeHTTP(res, httptest.NewRequest(http.MethodPut, "/api/v1/dashboards/"+tc.uid, strings.NewReader(tc.body)))
			if res.Code != tc.status {
				t.Fatalf("got %d (%s), want %d", res.Code, res.Body.String(), tc.status)
			}
			if tc.status == 200 && !strings.Contains(res.Body.String(), `"title":"Updated"`) {
				t.Fatal(res.Body.String())
			}
		})
	}
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

	newHandler(fakeDashboardStore{}, fakeQueryRunner{}).ServeHTTP(res, req)

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

	newHandler(store, fakeQueryRunner{}).ServeHTTP(res, req)

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

	newHandler(fakeDashboardStore{}, fakeQueryRunner{}).ServeHTTP(res, req)

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

func TestRunQuery(t *testing.T) {
	runner := fakeQueryRunner{frame: query.TableFrame{
		Fields: []query.Field{{Name: "name", Type: "string"}},
		Rows:   [][]any{{"dashboard-lab"}},
	}}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/query", strings.NewReader(`{"sql":"SELECT name FROM items"}`))
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()

	newHandler(fakeDashboardStore{}, runner).ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}
	if got := res.Body.String(); !strings.Contains(got, "dashboard-lab") {
		t.Fatalf("expected query result in response, got %q", got)
	}
}

func TestRunQueryRejectsNonSelectStatement(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/query", strings.NewReader(`{"sql":"DELETE FROM items"}`))
	res := httptest.NewRecorder()

	newHandler(fakeDashboardStore{}, fakeQueryRunner{err: query.ErrInvalidStatement}).ServeHTTP(res, req)

	if res.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, res.Code)
	}
}
