package main

import (
	"context"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"guideforge/backend/internal/api"
)

func main() {
	port := os.Getenv("GUIDEFORGE_BACKEND_PORT")
	if port == "" {
		port = "3939"
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	server := &http.Server{
		Addr:         "127.0.0.1:" + port,
		Handler:      api.NewRouter(),
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  30 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Printf("GuideForge backend listening on http://%s", server.Addr)
		errCh <- server.ListenAndServe()
	}()

	// Shut down on SIGINT/SIGTERM.
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	go func() {
		select {
		case sig := <-sigCh:
			log.Printf("received %s, shutting down", sig)
			cancel()
		case <-ctx.Done():
		}
	}()

	// Sidecar mode: when the parent (Tauri shell) exits or crashes, our
	// stdin pipe reaches EOF. Exit so we never orphan a background process.
	go func() {
		_, err := io.Copy(io.Discard, os.Stdin)
		if err == nil || !errors.Is(err, os.ErrClosed) {
			log.Printf("parent closed stdin (%v), shutting down", err)
			cancel()
		}
	}()

	// Perform a graceful shutdown once any cancel path fires.
	go func() {
		<-ctx.Done()
		shutdownCtx, done := context.WithTimeout(context.Background(), 5*time.Second)
		defer done()
		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("graceful shutdown error: %v", err)
		}
	}()

	if err := <-errCh; err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("server error: %v", err)
	}
}