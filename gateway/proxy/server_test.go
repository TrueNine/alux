package proxy

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestServerForwardsSupportedProtocolsAndRunsHooks(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/responses" {
			t.Errorf("path = %q", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer client-token" {
			t.Errorf("authorization was not forwarded")
		}
		body, _ := io.ReadAll(r.Body)
		if string(body) != `{"rewritten":true}` {
			t.Errorf("body = %s", body)
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, "data: [DONE]\n\n")
	}))
	defer upstream.Close()

	server, err := NewServer(Config{Upstreams: map[Protocol]string{ProtocolOpenAI: upstream.URL}}, HookFunc{
		BeforeFunc: func(_ context.Context, request *RequestContext) error {
			request.Body = []byte(`{"rewritten":true}`)
			return nil
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(`{"original":true}`))
	request.Header.Set("Authorization", "Bearer client-token")
	recorder := httptest.NewRecorder()
	server.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}
	if recorder.Body.String() != "data: [DONE]\n\n" {
		t.Errorf("response = %q", recorder.Body.String())
	}
}

func TestHealthAndUnsupportedPath(t *testing.T) {
	server, err := NewServer(Config{})
	if err != nil {
		t.Fatal(err)
	}
	for path, want := range map[string]int{"/healthz": http.StatusOK, "/unknown": http.StatusNotFound} {
		recorder := httptest.NewRecorder()
		server.Handler().ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
		if recorder.Code != want {
			t.Errorf("%s status = %d, want %d", path, recorder.Code, want)
		}
	}
}
