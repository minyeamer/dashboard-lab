package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/minyeamer/dashboard-lab/backend/internal/dashboard"
	"github.com/minyeamer/dashboard-lab/backend/internal/query"
)

type healthResponse struct {
	Status string `json:"status"`
}

func main() {
	port := os.Getenv("APP_PORT")
	if port == "" {
		port = "8080"
	}

	databaseURL := os.Getenv("METADATA_DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("METADATA_DATABASE_URL is required")
	}

	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		log.Fatalf("open metadata database: %v", err)
	}
	defer db.Close()

	if err := db.PingContext(context.Background()); err != nil {
		log.Fatalf("ping metadata database: %v", err)
	}

	analyticsDB, err := sql.Open("pgx", os.Getenv("ANALYTICS_DATABASE_URL"))
	if err != nil {
		log.Fatalf("open analytics database: %v", err)
	}
	defer analyticsDB.Close()

	if err := analyticsDB.PingContext(context.Background()); err != nil {
		log.Fatalf("ping analytics database: %v", err)
	}

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           newHandler(dashboard.NewPostgresStore(db), query.NewPostgresRunner(analyticsDB)),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("dashboard-lab API listening on %s", server.Addr)
	log.Fatal(server.ListenAndServe())
}

func health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, healthResponse{Status: "ok"})
}

func newHandler(store dashboard.Store, runner query.Runner) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", health)
	mux.HandleFunc("GET /api/v1/dashboards", listDashboards(store))
	mux.HandleFunc("GET /api/v1/dashboards/{uid}", getDashboard(store))
	mux.HandleFunc("PUT /api/v1/dashboards/{uid}", updateDashboard(store))
	mux.HandleFunc("POST /api/v1/query", runQuery(runner))
	return cors(mux)
}

type queryRequest struct {
	SQL string `json:"sql"`
}

func runQuery(runner query.Runner) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var request queryRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			writeError(w, http.StatusBadRequest, "request body must contain SQL")
			return
		}

		frame, err := runner.Query(r.Context(), request.SQL)
		if errors.Is(err, query.ErrInvalidStatement) {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		if query.IsTimeout(err) {
			writeError(w, http.StatusGatewayTimeout, "query timed out after 3 seconds")
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, query.FormatError(err))
			return
		}

		writeJSON(w, http.StatusOK, frame)
	}
}

func listDashboards(store dashboard.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		items, err := store.List(r.Context())
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not load dashboards")
			return
		}

		writeJSON(w, http.StatusOK, items)
	}
}

func getDashboard(store dashboard.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		item, err := store.GetByUID(r.Context(), r.PathValue("uid"))
		if errors.Is(err, dashboard.ErrNotFound) {
			writeError(w, http.StatusNotFound, "dashboard not found")
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not load dashboard")
			return
		}

		writeJSON(w, http.StatusOK, item)
	}
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func updateDashboard(store dashboard.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 512*1024)
		decoder := json.NewDecoder(r.Body)
		decoder.DisallowUnknownFields()
		var document dashboard.Document
		if err := decoder.Decode(&document); err != nil {
			writeError(w, http.StatusBadRequest, "저장할 JSON 형식이 올바르지 않습니다.")
			return
		}
		if err := decoder.Decode(&struct{}{}); err != io.EOF {
			writeError(w, http.StatusBadRequest, "JSON 문서는 하나만 전송해 주세요.")
			return
		}
		if err := document.Validate(); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		item, err := store.Update(r.Context(), r.PathValue("uid"), document)
		if errors.Is(err, dashboard.ErrNotFound) {
			writeError(w, http.StatusNotFound, "dashboard not found")
			return
		}
		if err != nil {
			writeError(w, http.StatusInternalServerError, "대시보드를 저장하지 못했습니다. 다시 시도해 주세요.")
			return
		}
		writeJSON(w, http.StatusOK, item)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"message": message})
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
		next.ServeHTTP(w, r)
	})
}
