# Edge Photos — Beyond the frame

A cinematic, responsive photography site with a persistent studio workspace, client proofing, bookings and payment adapters. Built with React, Vinext and Lenis, with Railway Node/SQLite/private-volume and Sites D1/R2 runtime targets.

## Railway deployment

This repository includes a production Node 24 target for Railway. `railway.json` selects the Dockerfile and `/api/health` check. The server binds `0.0.0.0` on Railway's assigned `PORT`; it does not run Wrangler or a preview server.

Before accepting client work:

1. Mount one Railway persistent volume at `/data` on this service. Keep one replica. `STUDIO_DATA_DIR` must match the volume mount path (Docker defaults to `/data`). SQLite records and private photo files live on that volume. Both booking writes and photo uploads are blocked when Railway reports no matching persistent mount.
2. Set `STUDIO_ADMIN_EMAIL` to the photographer's login email and `STUDIO_ADMIN_PASSWORD` to a strong secret of at least 16 characters through Railway variables. Optionally set a separate random `STUDIO_SESSION_SECRET` of at least 32 characters. Never commit these values. This deployment uses password sign-in at `/studio-login`; it does not rely on ChatGPT identity headers. Requests that spoof platform identity headers cannot access the admin API.
3. Deploy the `main` branch. Migrations run transactionally on startup and previously applied files are checked for changes. `/api/health` returns 200 after the database is ready.
4. Sign in, set actual rates and payment instructions, and approve pricing. Configure payment gateway secrets only when the actual accounts are ready.

Use `pnpm run build:railway`, then `pnpm start` for the Node target. `pnpm run test:railway` exercises the actual production HTTP server after a Railway build, including persistence across a restart. Local standalone data defaults to `.studio-data/`, which is ignored by Git.

The existing Sites/Cloudflare target remains available: without the Railway target flag the build preserves D1/R2 and ChatGPT authentication, and `start:sites` is its local Worker preview command. The two hosts have separate databases and photo storage; this code change does not transfer existing hosted data.

## Routes

- `/` — portfolio and four-step booking flow
- `/admin` — protected photographer workspace
- `/admin/preview` — clearly labeled read-only sample workspace
- `/gallery/demo` — sample selection experience with concept photography
- `/gallery/:token` — expiring bearer-link client gallery
- `/booking/:token` — private booking, invoice, calendar export and payment page

## Studio setup before client launch

The Sites preview starts owner-private. Railway uses its own public domain and protected studio login. Keep admin authorization configured before client launch.

1. Sign in to `/admin` using an account whose email is in the `STUDIO_ADMIN_EMAIL` runtime variable. The owner can change that comma-separated allowlist when handing over to the photographer.
2. Replace the clearly labeled concept photography with original, licensed work. The supplied logos are preserved under `public/images/`.
3. In Settings set real JMD and USD package totals, deposit percentage, lead time, booking horizon, closed weekdays and blocked dates. Approve rates to open booking requests. Defaults are illustrative and payment collection is unavailable until accounts are configured.
4. Add payment instructions and approved provider-hosted links. Independently verify recipient details and account eligibility with the provider.
5. Enter provider secrets through Sites environment variables, test with the photographer's sandbox accounts, then explicitly set the mode to `live` and redeploy. Never commit secrets or put them in browser code.
6. Agree cancellation, refund, rescheduling and turnaround terms with clients before collecting money. This build does not invent the photographer's commercial terms.

## Client workflow

Create a gallery, upload proof photographs (JPG/PNG/WebP, 20 MB each), open proofing, then copy its private link or use Compose client invitation. The compose action opens the owner's email application; this build does not claim to send email automatically. Gallery links expire after 30 days and possession of the link grants access to that collection.

Clients heart up to the selection limit, add notes, and submit. Selected filenames and notes appear in the workspace. Export the filename list, edit externally, upload final images, and publish the final collection. Clients can download individual final files. R2 files are served through the authorized API; the bucket is not public. Watermarks on proof previews are a visual deterrent, not DRM.

## Bookings

The server validates availability, lead time, closures, booking horizon, prices and payment methods. D1 inserts the booking and its occupied slots in one atomic batch; slot primary keys prevent conflicts. Standard sessions reserve two-hour calendar blocks (including buffer). Full-day weddings reserve all four blocks. Requests hold slots until the photographer confirms or cancels them. Cancelling releases occupied slots; cancelled bookings cannot be silently restored.

Booking approval and payment tracking are separate. Clients must save their booking link. Payment opens after photographer confirmation. Calendar downloads use America/Jamaica. The invoice can be printed/saved as PDF with the browser.

## Payment adapters and limitations

- **Cash, bank transfer, Lynk instructions:** manual verification of client-submitted payment references. A reference never marks a payment received by itself. Confirm that the account and intended use meet the provider's terms.
- **WiPay personal links:** approved HTTPS link, external payment and manual receipt verification. WiPay advertises individual payment links without business registration; eligibility and Jamaica settlement must be confirmed for the actual account.
- **PayPal:** REST Orders v2 create and capture. Separate studio-set USD quote; no implied JMD conversion rate. Server verifies captured status, booking custom ID, currency and amount. Idempotency keys and reuse of pending orders reduce accidental retries. Requires eligible receiving account, REST client ID and secret. Defaults to sandbox; sandbox results never count as live deposits.
- **WiPay API:** Jamaica hosted checkout (`credit_card_co`) and server-side callback verification using `md5(transaction_id + original_total_to_two_decimals + api_key)`. Stored amount and stored transaction ID are used. Requires verified WiPay business account. Defaults to sandbox. Sandbox results never count as live deposits.
- **Fygaro and bank card providers:** approved hosted-link adapter with manual receipt verification. Merchant approval, bank eligibility and actual payment-page setup are external dependencies. This is not a direct integration with every Jamaican bank or gateway.

No account credentials were supplied, so no real payment was collected or end-to-end provider transaction verified. Automated refunds, chargeback webhooks, installment collection and automatic email are not enabled. Reconcile refunds and disputes with the provider and studio records.

### Runtime variable names

`STUDIO_ADMIN_EMAIL`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE` (`sandbox` or `live`), `WIPAY_ACCOUNT_NUMBER`, `WIPAY_API_KEY`, `WIPAY_MODE` (`sandbox` or `live`). D1 binding `DB`; private file bucket binding `BUCKET`.

### Primary payment documentation checked

- https://wipaycaribbean.com/ — individual personal payment links
- https://docs.wipayfinancial.com/payments-api — verified business-account prerequisites
- https://docs.wipayfinancial.com/payments-api/payment-request — hosted checkout parameters
- https://docs.wipayfinancial.com/payments-api/transaction-response — response hash verification
- https://developer.paypal.com/api/orders/v2 — create/capture API
- https://www.paypal.com/jm/business/accept-payments/checkout — Jamaica checkout offering

## Validation

`npm test` runs isolated API integration checks with an in-memory SQLite database and R2 mock. It checks authorization, conflict rollback, booking rules, cancellations, manual payment review, the gallery lifecycle, expiry, file access, missing provider configuration, forged callbacks and origin validation. It does not make payment network calls or touch production data.

`node node_modules/typescript/bin/tsc --noEmit` checks TypeScript. Build using the Sites build helper. Database migrations are schema-only and deploy through Sites. Development data is excluded from the source archive.

## Asset provenance

The three concept photographs were created with the built-in image-generation tool and optimized to WebP. Prompts: a cinematic Black Jamaican fashion portrait in golden side light with negative space; a Caribbean bride and groom in a sunset garden; a burgundy-gown birthday editorial against terracotta. They are clearly labeled as illustrative and do not claim to be the photographer's portfolio. Original supplied logo files are retained. The attached lunar brief informed the single animation loop, scroll-driven progression, cinematic composition and reduced-motion handling; its lunar assets and copy are not used.


## Multi-page experience

The public site now has 16 content pages: `/`, `/work`, three individual collections at `/work/portraits`, `/work/weddings`, `/work/celebrations`, `/sessions`, `/experience`, `/about`, `/journal`, four articles at `/journal/[slug]`, `/client-lounge`, `/contact`, and `/book`. Shared navigation uses actual routes. Package rates come from studio configuration; unapproved rates stay identified as previews. Concept photographs remain labelled.

The field notes planner stores a session brief and preparation checklist only in the visitor's browser. It supports a text download, reset, and explicit handoff to `/book?session=…&from=planner`; that brief is submitted to the existing studio API only when the visitor submits their booking request. WhatsApp enquiries open a reviewable message, never send automatically.

Studio sections have direct routes at `/admin/bookings`, `/admin/galleries`, `/admin/payments`, and `/admin/settings`, with equivalent illustrative tour routes under `/admin/preview/`. These preserve the existing protected API and selection/edit/delivery workflow.

Validation: `pnpm test`, `pnpm build:railway`, and `pnpm test:railway`. The production runtime suite checks content pages, missing-page 404s, internal route destinations, and the full authenticated booking/gallery/persistence workflow. GitHub main remains the source for Railway auto-deployment; this change does not provision hosting variables, a persistent volume, or payment accounts.
