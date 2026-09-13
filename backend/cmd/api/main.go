package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
)

type healthResponse struct {
	Status string `json:"status"`
	Phase  string `json:"phase"`
}

func main() {
	port := os.Getenv("APP_PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", health)

	server := &http.Server{
		Addr:    ":" + port,
		Handler: cors(mux),
	}

	log.Printf("dashboard-lab API listening on %s", server.Addr)
	log.Fatal(server.ListenAndServe())
}

func health(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(healthResponse{Status: "ok", Phase: "0"})
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
		next.ServeHTTP(w, r)
	})
}
