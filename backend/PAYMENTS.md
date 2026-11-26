# Payment links

The CRM can create customer-specific links for CIPS Level 4 instalments and exam fees. A Level 4 link counts toward the $700 brochure fee; an exam fee does not. Payment does not change a lead into a student.

Existing payments from the old website are not in this database. Staff must check those receipts before issuing a new instalment link, or the customer could be charged too much.

## Sandbox setup

1. Apply the migration with `npx prisma migrate deploy` and restart the backend.
2. Add `SSLCOMMERZ_MODE=sandbox`, `SSLCOMMERZ_STORE_ID`, and `SSLCOMMERZ_STORE_PASSWORD` to backend `.env` or the backend hosting environment. Use sandbox credentials from the company's SSLCommerz merchant account.
3. Set `BACKEND_PUBLIC_URL` to the backend's public HTTPS origin and `FRONTEND_PUBLIC_URL` to the site's public origin. Set `NEXT_PUBLIC_API_URL` in the frontend to the same public backend origin, then rebuild the frontend.
4. In the SSLCommerz sandbox merchant panel, enable the HTTP IPN listener at `https://<backend-host>/api/payments/callback/ipn`.
5. Create a payment request from CRM → Payment links. Open its link and complete a sandbox payment. Check the request reaches `PAID` only after gateway validation.

The app sends the agreed USD amount to SSLCommerz, which presents its own conversion when relevant. Failed or uncertain gateway results are not treated as paid. Risky transactions are held for review. A customer link is secret and should be shared only with that customer.

Before switching to `SSLCOMMERZ_MODE=live`, confirm the company's merchant credentials, public callback URL, refund policy, and settlement currency with the account owner. Live credentials must remain server-side.
