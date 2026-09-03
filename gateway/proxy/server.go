package proxy

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync/atomic"
	"time"
)

// Protocol identifies a supported provider wire protocol.
type Protocol string

const (
	ProtocolGoogle    Protocol = "google"
	ProtocolOpenAI    Protocol = "openai"
	ProtocolAnthropic Protocol = "anthropic"
)

// Config describes the local listener and upstream provider endpoints.
type Config struct {
	ListenAddress  string              `json:"listen_address"`
	Upstreams      map[Protocol]string `json:"upstreams"`
	RequestTimeout time.Duration       `json:"request_timeout"`
	LogBodies      bool                `json:"log_bodies"`
}

func (c Config) withDefaults() Config {
	if c.ListenAddress == "" {
		c.ListenAddress = "127.0.0.1:15721"
	}
	if c.RequestTimeout <= 0 {
		c.RequestTimeout = 10 * time.Minute
	}
	if c.Upstreams == nil {
		c.Upstreams = map[Protocol]string{}
	}
	return c
}

// RequestContext is the mutable interception point for request middleware.
type RequestContext struct {
	Protocol Protocol
	Request  *http.Request
	Body     []byte
}

// ResponseContext is the interception point after the upstream response arrives.
type ResponseContext struct {
	Protocol Protocol
	Request  *http.Request
	Response *http.Response
}

// Hook can inspect or rewrite requests and responses. Hooks run in registration order.
type Hook interface {
	Before(ctx context.Context, request *RequestContext) error
	After(ctx context.Context, response *ResponseContext) error
}

// HookFunc is a convenient adapter for small integrations.
type HookFunc struct {
	BeforeFunc func(context.Context, *RequestContext) error
	AfterFunc  func(context.Context, *ResponseContext) error
}

func (h HookFunc) Before(ctx context.Context, r *RequestContext) error {
	if h.BeforeFunc == nil {
		return nil
	}
	return h.BeforeFunc(ctx, r)
}
func (h HookFunc) After(ctx context.Context, r *ResponseContext) error {
	if h.AfterFunc == nil {
		return nil
	}
	return h.AfterFunc(ctx, r)
}

// Stats exposes process-local proxy counters.
type Stats struct{ Requests, Responses, Errors atomic.Uint64 }

// Server is a protocol-aware reverse proxy with explicit request/response hooks.
type Server struct {
	config Config
	hooks  []Hook
	client *http.Client
	stats  *Stats
	logger *slog.Logger
}

func NewServer(config Config, hooks ...Hook) (*Server, error) {
	config = config.withDefaults()
	for protocol, raw := range config.Upstreams {
		u, err := url.Parse(raw)
		if err != nil || u.Scheme == "" || u.Host == "" {
			return nil, fmt.Errorf("invalid %s upstream %q", protocol, raw)
		}
	}
	return &Server{config: config, hooks: hooks, client: &http.Client{Timeout: config.RequestTimeout}, stats: new(Stats), logger: slog.Default()}, nil
}

func (s *Server) Stats() *Stats { return s.stats }

// Handler returns a net/http handler suitable for http.Server.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, "ok\n")
	})
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, _ *http.Request) {
		for _, protocol := range []Protocol{ProtocolGoogle, ProtocolOpenAI, ProtocolAnthropic} {
			if s.config.Upstreams[protocol] == "" {
				http.Error(w, "missing upstream: "+string(protocol), http.StatusServiceUnavailable)
				return
			}
		}
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, "ready\n")
	})
	mux.Handle("/", s)
	return mux
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	protocol, ok := protocolForPath(r.URL.Path)
	if !ok {
		http.Error(w, "unsupported protocol path", http.StatusNotFound)
		return
	}
	upstream := s.config.Upstreams[protocol]
	if upstream == "" {
		http.Error(w, "upstream is not configured for "+string(protocol), http.StatusBadGateway)
		return
	}
	s.stats.Requests.Add(1)
	start := time.Now()

	body, err := io.ReadAll(r.Body)
	if err != nil {
		s.fail(w, "read request body", err)
		return
	}
	ctx := r.Context()
	reqCtx := &RequestContext{Protocol: protocol, Request: r, Body: body}
	for _, hook := range s.hooks {
		if err := hook.Before(ctx, reqCtx); err != nil {
			s.fail(w, "before hook", err)
			return
		}
	}
	r.Body = io.NopCloser(bytes.NewReader(reqCtx.Body))
	r.ContentLength = int64(len(reqCtx.Body))

	target, _ := url.Parse(upstream)
	proxy := httputil.NewSingleHostReverseProxy(target)
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		// Preserve the client path and query while replacing only scheme/host.
		req.URL.Path = joinURLPath(target.Path, r.URL.Path)
		req.URL.RawPath = ""
		req.URL.RawQuery = r.URL.RawQuery
		req.Host = target.Host
		if req.Header.Get("Content-Type") == "" {
			req.Header.Set("Content-Type", "application/json")
		}
	}
	transport := http.DefaultTransport
	if s.client.Transport != nil {
		transport = s.client.Transport
	}
	proxy.Transport = roundTripperFunc(func(req *http.Request) (*http.Response, error) {
		response, err := transport.RoundTrip(req)
		if err != nil {
			return nil, err
		}
		responseCtx := &ResponseContext{Protocol: protocol, Request: r, Response: response}
		for i := len(s.hooks) - 1; i >= 0; i-- {
			if hookErr := s.hooks[i].After(ctx, responseCtx); hookErr != nil {
				_ = response.Body.Close()
				return nil, hookErr
			}
		}
		s.stats.Responses.Add(1)
		s.logger.Info("proxy request", "protocol", protocol, "path", r.URL.Path, "status", response.StatusCode, "latency", time.Since(start))
		return responseCtx.Response, nil
	})
	proxy.ErrorHandler = func(writer http.ResponseWriter, _ *http.Request, proxyErr error) {
		s.fail(writer, "upstream request", proxyErr)
	}
	proxy.ServeHTTP(w, r)
}

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (f roundTripperFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func (s *Server) fail(w http.ResponseWriter, operation string, err error) {
	s.stats.Errors.Add(1)
	s.logger.Error(operation, "error", err)
	http.Error(w, "proxy error", http.StatusBadGateway)
}

func protocolForPath(path string) (Protocol, bool) {
	switch {
	case strings.Contains(path, ":generateContent"), strings.Contains(path, "/v1beta/models/"):
		return ProtocolGoogle, true
	case strings.HasPrefix(path, "/v1/responses"):
		return ProtocolOpenAI, true
	case strings.HasPrefix(path, "/v1/messages"):
		return ProtocolAnthropic, true
	default:
		return "", false
	}
}

func joinURLPath(base, path string) string {
	return strings.TrimRight(base, "/") + "/" + strings.TrimLeft(path, "/")
}

// LoadConfig decodes a JSON configuration file.
func LoadConfig(reader io.Reader) (Config, error) {
	var c Config
	if err := json.NewDecoder(reader).Decode(&c); err != nil {
		return Config{}, err
	}
	return c, nil
}
