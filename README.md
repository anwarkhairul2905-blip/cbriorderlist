# Cart by Ryna Orders

Shared ordering app for Cart by Ryna Ismail.

## What it does

- Customer order form for nasi lemak pre-orders
- Cash or bank transfer payment
- Receipt upload and verification flow for bank transfer orders
- Shared admin dashboard for order tracking
- Pickup-time grouping, unpaid/paid/taken status, and sales reports

## Run locally

```bash
npm install
npm start
```

The app starts on `http://localhost:3000` unless `PORT` is set.

## Admin access

The server reads the admin password from `ADMIN_PASSWORD`.

If `ADMIN_PASSWORD` is not set, the local fallback password is:

`ryna2026`

Use a stronger password in production.

## Data storage

Orders and settings are stored in:

`data/store.json`

That file is ignored by git, so each server keeps its own live order data.

## Production notes

- Set `ADMIN_PASSWORD` on the server.
- Set the site or server to public access if customers need to open it directly.
- If you move the app to another host, make sure the `start` script runs `node server.js`.

## Repository

Source repo:

`https://github.com/anwarkhairul2905-blip/cbriorderlist.git`
