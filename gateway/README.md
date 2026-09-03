# ALUX Gateway

ALUX Gateway is a local Go daemon that transparently forwards supported model API protocols while exposing request and response interception hooks.

Supported protocol paths:

- Google Gemini: `/v1beta/models/{model}:generateContent` and `/v1beta/models/{model}:streamGenerateContent`
- OpenAI Responses: `/v1/responses`
- Anthropic Messages: `/v1/messages`

The gateway forwards HTTP headers, status codes, response bodies, streaming responses, and query strings. It does not translate protocol payloads yet. A `Hook` can inspect, rewrite, compress, redact, or alert on a request or response before the bytes continue upstream or downstream.

## Run

Go generics are supported by the language. This first implementation uses Go 1.26 and relies on the standard library, including `net/http`, `httputil`, `context`, and `log/slog`.

```bash
go run ./cmd/alux-gateway \
  -listen 127.0.0.1:15721 \
  -google-upstream https://generativelanguage.googleapis.com \
  -openai-upstream https://api.openai.com \
  -anthropic-upstream https://api.anthropic.com
```

The same values can be supplied with `ALUX_GATEWAY_*` environment variables. The daemon exits cleanly on `SIGINT` and `SIGTERM`.

Health checks are available at `/healthz` and `/readyz`.

## Integration

Create a server and register hooks in order:

```go
server, err := proxy.NewServer(proxy.Config{
    ListenAddress: "127.0.0.1:15721",
    Upstreams: map[proxy.Protocol]string{
        proxy.ProtocolGoogle: "https://generativelanguage.googleapis.com",
        proxy.ProtocolOpenAI: "https://api.openai.com",
        proxy.ProtocolAnthropic: "https://api.anthropic.com",
    },
}, proxy.HookFunc{
    BeforeFunc: func(ctx context.Context, request *proxy.RequestContext) error {
        // request.Body and request.Request are intentionally mutable.
        return nil
    },
    AfterFunc: func(ctx context.Context, response *proxy.ResponseContext) error {
        // response.Response can be inspected or replaced here.
        return nil
    },
})
if err != nil { return err }

httpServer := &http.Server{Addr: config.ListenAddress, Handler: server.Handler()}
return httpServer.ListenAndServe()
```

For production, put the daemon behind a service manager such as systemd and bind it to loopback unless remote access is explicitly required.
