package api

import (
	"encoding/json"
	"log"
	"net/http"
	"time"
)

// Version is the GuideForge backend version. Keep it in sync with the
// release in the top-level project.
const Version = "0.1.0"

type healthResponse struct {
	Status  string `json:"status"`
	App     string `json:"app"`
	Version string `json:"version"`
}

type versionResponse struct {
	Version string `json:"version"`
}

func NewRouter() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("GET /version", handleVersion)
	return withCORS(withLogging(mux))
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, healthResponse{
		Status:  "ok",
		App:     "GuideForge Backend",
		Version: Version,
	})
}

func handleVersion(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, versionResponse{Version: Version})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

// withCORS allows the Tauri webview (and the browser during dev) to call
// the backend from another origin.
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s (%s)", r.Method, r.URL.Path, time.Since(start))
	})
}