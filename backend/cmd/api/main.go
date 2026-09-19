package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/minyeamer/dashboard-lab/backend/internal/dashboard"
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

	server := &http.Server{
		Addr:    ":" + port,
		Handler: newHandler(dashboard.NewPostgresStore(db)),
	}

	log.Printf("dashboard-lab API listening on %s", server.Addr)
	log.Fatal(server.ListenAndServe())
}

func health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, healthResponse{Status: "ok"})
}

func newHandler(store dashboard.Store) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", health)
	mux.HandleFunc("GET /api/v1/dashboards", listDashboards(store))
	mux.HandleFunc("GET /api/v1/dashboards/{uid}", getDashboard(store))
	return cors(mux)
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

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"message": message})
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
		next.ServeHTTP(w, r)
	})
}
