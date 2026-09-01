# Frontend REST client layer

This folder contains browser-side request wrappers. It is not the application's
REST API implementation.

- `api-client.js` is the single low-level `fetch` client. It uses relative
  `/api` URLs, includes the server-side session cookie, normalizes JSON errors,
  and attaches the in-memory CSRF token to unsafe methods.
- Feature `*.api.js` modules expose browser-facing operations for React code.
- `auth-bootstrap.js` coordinates the one startup authentication probe without
  caching user state.

The actual REST API is implemented by Express under
`backend/src/modules/*/*.routes.js`, with controllers and services in the same
backend modules.

```text
React components
  -> frontend/src/api (browser REST client wrappers)
  -> backend/src/modules (Express REST API)
  -> database and backend-only providers
```

Protected Supabase credentials and Gemini credentials must remain backend-only.
