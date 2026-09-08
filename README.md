# FCspecialist live platform

Full-stack Node/Express site using the FCspecialist visual master, customer accounts, booking slots and Stripe Checkout.

## Current services
- Gameplay Review — £15 one-off
- 1:1 Live Coaching — £25 one-off
- Monthly Coaching — £149/month recurring

## Local test
1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Set a strong `JWT_SECRET`.
5. Leave Stripe variables blank to test account/booking flow in demo mode.
6. Run `npm start` and open http://localhost:3000.

## Stripe
Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in the hosting provider's environment variables. The app uses Stripe-hosted Checkout. Monthly Coaching uses a recurring monthly Checkout price. Configure a webhook for `/api/stripe/webhook` and listen for `checkout.session.completed`, `invoice.paid`, and `customer.subscription.deleted`.

## Deployment
Recommended quick path: Render Web Service. Build command: `npm install`. Start command: `npm start`.

For production customer/order persistence, use a persistent disk for the SQLite database or migrate the database to managed Postgres before scaling. Do not put Stripe secret keys in the website source code.
