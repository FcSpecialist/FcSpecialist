# FCspecialist

FCspecialist is a Node/Express + SQLite coaching platform with Stripe Checkout, customer accounts, gameplay-review submission and coaching bookings.

## Services
- Gameplay Review — £15
- 1:1 Live Coaching — £25
- Monthly Coaching — £149/month (up to 8 sessions)
- FUT Champions coaching packages: Rank 1 £55, Rank 2 £50, Rank 3 £40, Rank 4 £30, Rank 5 £25

## Important
This site does not collect EA or PSN passwords and does not provide account-boosting/account-sharing services. Customers keep control of their own account.

## Render environment variables
- `BASE_URL`
- `JWT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- optional `STRIPE_CURRENCY=gbp`

## Stripe webhook
Endpoint: `/api/stripe/webhook`
Events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`

## Before launch
1. Test every service in Stripe Sandbox.
2. Remove/ignore old test orders before opening to customers.
3. Switch Stripe to Live keys only after final testing.
4. Use persistent production storage (SQLite on an ephemeral filesystem is not suitable for long-term customer data).
