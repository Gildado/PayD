# API error responses

Every error response from the PayD backend is an [RFC 7807](https://www.rfc-editor.org/rfc/rfc7807) /
[RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) problem document, served as
`application/problem+json`.

```http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json; charset=utf-8

{
  "type": "urn:payd:error:validation-error",
  "title": "Validation failed",
  "status": 400,
  "detail": "Request validation failed",
  "instance": "/api/v1/employees",
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": [{ "path": "email", "message": "Invalid email address", "code": "invalid_string" }],
  "errors": [{ "path": "email", "message": "Invalid email address", "code": "invalid_string" }],
  "requestId": "3f1c2a0e-..."
}
```

## Members

| Member      | Always present | Meaning                                                                                                   |
| ----------- | -------------- | --------------------------------------------------------------------------------------------------------- |
| `type`      | yes            | Stable URN identifying the error class. **Branch on this.**                                               |
| `title`     | yes            | Short summary for the type. Constant per type. Do not parse.                                              |
| `status`    | yes            | HTTP status code, repeated in the body.                                                                   |
| `detail`    | yes            | Human-readable explanation for this occurrence. Safe to show to users. Do not parse.                      |
| `instance`  | yes            | Request path that produced the error (query string removed).                                              |
| `requestId` | when available | Correlates the response with server logs.                                                                 |
| `errors`    | validation     | Field-level failures: `{ path, message, code }`. `path` is dot-separated, e.g. `items.0.amount`.          |
| `code`      | yes            | Legacy error code (see below). Kept for existing clients.                                                 |
| `message`   | yes            | Legacy alias of `detail`. Kept for existing clients.                                                      |
| `details`   | yes            | Legacy alias of `errors` (empty array when there are no field errors). Kept for existing clients.         |

Clients must ignore unknown members.

## Error types

The `type` URN is stable. New types may be added; existing types are not renamed or repurposed.

| `type`                                  | Status | Legacy `code`      | When it is returned                                                                 |
| --------------------------------------- | ------ | ------------------ | ----------------------------------------------------------------------------------- |
| `urn:payd:error:validation-error`       | 400    | `VALIDATION_ERROR` | Request body, query or path failed schema validation. `errors` lists each field.    |
| `urn:payd:error:bad-request`            | 400    | `BAD_REQUEST`      | Malformed request that is not a schema failure (e.g. invalid ID or cursor).         |
| `urn:payd:error:unauthorized`           | 401    | `UNAUTHORIZED`     | Missing or invalid authentication.                                                  |
| `urn:payd:error:forbidden`              | 403    | `FORBIDDEN`        | Authenticated but not allowed, or no organization context.                          |
| `urn:payd:error:not-found`              | 404    | `NOT_FOUND`        | Resource does not exist or is outside the caller's organization.                    |
| `urn:payd:error:conflict`               | 409    | `CONFLICT`         | Request conflicts with current state (e.g. duplicate).                              |
| `urn:payd:error:unprocessable`          | 422    | `UNPROCESSABLE`    | Request is well-formed but cannot be processed (e.g. insufficient balance).         |
| `urn:payd:error:payload-too-large`      | 413    | `PAYLOAD_TOO_LARGE`| Request body exceeds the size limit.                                                |
| `urn:payd:error:rate-limited`           | 429    | `RATE_LIMITED`     | Too many requests. Honour the `Retry-After` header.                                 |
| `urn:payd:error:internal-error`         | 500    | `INTERNAL_ERROR`   | Unexpected server failure. `detail` is generic in production; use `requestId`.     |

The `status` member may differ from the default for a type when the handler sets it explicitly.

## Field errors (`errors`)

Each entry has:

- `path`: dot-separated path to the offending field. Empty string for top-level body errors.
- `message`: human-readable message. Safe to display next to the field.
- `code`: validation rule identifier from the schema library (for example `invalid_string`, `too_small`).

## Frontend handling

`frontend/src/api/problemDetails.ts` parses these bodies:

- `parseProblemDetails(body)` returns a typed `ProblemDetails`, or `null` for non-problem bodies.
- `isProblemType(problem, PROBLEM_TYPES.validationError)` branches on the stable type.
- `getProblemErrorMessage(body, fallback)` returns the user-facing message.

The shared Axios interceptor (`frontend/src/api/axiosInstance.ts`) uses these helpers. Errors that carry a
problem document expose it as `error.problem`.

## Migration notes

- Existing clients that read `code`, `message` or `details` keep working.
- Clients that check `Content-Type: application/json` should accept `application/problem+json`
  (a subtype of JSON in practice; most HTTP libraries parse it automatically).
- Some older endpoints still return `{ error, details }` bodies. They are not problem documents yet
  and will be migrated endpoint by endpoint.
