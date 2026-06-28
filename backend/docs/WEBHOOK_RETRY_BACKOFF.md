# Webhook Retry With Exponential Backoff

PayD retries failed webhook deliveries up to 4 total attempts per subscribed endpoint.

## Delivery Behavior

- Attempt 1 is sent immediately.
- Retries use exponential backoff delays of 1 second, 2 seconds, and 4 seconds.
- Each attempt is recorded in `webhook_delivery_logs` with its own `attempt_number`.
- A delivery is considered successful when the subscriber responds with a successful HTTP status.
- If all attempts fail, the final failed attempt is still logged for auditability.

## Operational Notes

- Delivery requests use a 5 second HTTP timeout per attempt.
- Retry logging captures the response status, serialized response body when available, and the normalized error message.
- Delivery logs can be queried through the existing webhook subscription delivery log endpoint.
