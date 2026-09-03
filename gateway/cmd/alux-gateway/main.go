package main

import (
	"context"
	"errors"
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/TrueNine/alux/gateway/proxy"
)

func main() {
	listen := flag.String("listen", envOr("ALUX_GATEWAY_LISTEN", "127.0.0.1:15721"), "local listen address")
	google := flag.String("google-upstream", os.Getenv("ALUX_GATEWAY_GOOGLE_UPSTREAM"), "Google Generative Language API base URL")
	openai := flag.String("openai-upstream", os.Getenv("ALUX_GATEWAY_OPENAI_UPSTREAM"), "OpenAI API base URL")
	anthropic := flag.String("anthropic-upstream", os.Getenv("ALUX_GATEWAY_ANTHROPIC_UPSTREAM"), "Anthropic API base URL")
	flag.Parse()

	server, err := proxy.NewServer(proxy.Config{ListenAddress: *listen, Upstreams: map[proxy.Protocol]string{
		proxy.ProtocolGoogle: *google, proxy.ProtocolOpenAI: *openai, proxy.ProtocolAnthropic: *anthropic,
	}})
	if err != nil {
		slog.Error("create gateway", "error", err)
		os.Exit(1)
	}

	httpServer := &http.Server{Addr: *listen, Handler: server.Handler(), ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 10 * time.Minute, WriteTimeout: 10 * time.Minute, IdleTimeout: 2 * time.Minute}
	go func() {
		slog.Info("gateway listening", "address", *listen)
		if serveErr := httpServer.ListenAndServe(); serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			slog.Error("gateway stopped", "error", serveErr)
			os.Exit(1)
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		slog.Error("shutdown gateway", "error", err)
		os.Exit(1)
	}
}

func envOr(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
