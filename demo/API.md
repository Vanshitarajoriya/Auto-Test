# Demo API (fake, not MSG91's real API)

Base URL `http://localhost:4020`. Every `/demo/*` call needs header `authkey: demo-authkey` (a wrong or missing key returns 401, `code: auth_failure`).
Test number: `9999900001` (the only entry in `TEST_RECIPIENTS`).

| Call | Body / query | Success | Errors |
| --- | --- | --- | --- |
| `POST /demo/otp/send` | `{ mobile, expiry_ms? }` | 200 `{ type:"success", request_id }` | 400 `mobile_required` |
| `POST /demo/otp/verify` | `{ request_id, otp }` | 200 `{ type:"success" }` | 400 `invalid_otp`, `otp_expired`, `already_verified`; 404 `unknown_request` |
| `POST /demo/otp/resend` | `{ request_id }` | 200 `{ type:"success" }`; a new OTP is generated | 404 `unknown_request` |
| `GET /demo/inbox?mobile=` | | 200 `{ otp, request_id }` = the latest OTP "received" on the test phone | 404 `nothing_received` |
| `GET /demo/logs?request_id=` | | 200 `{ logs:[{ request_id, mobile, event, at }] }`, events: sent, resent, verified, failed, expired | |
| `POST /demo/templates` | `{ name, body }` | 201 | 409 `exists` |
| `GET /demo/templates` | | 200 `{ templates:[names] }` | |
| `DELETE /demo/templates/:name` | | 200 | 404 |
