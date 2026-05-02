# VacationRentalExpertz

Gorgeous Vite + React website for `www.vacationrentalexpertz.com`, built around a clear two-unit beach rental model: nearby condos are combined into one guest-facing group stay so travelers can avoid the premium of a rare 6-bedroom beach house while still getting togetherness, shared amenities, and wind-down separation.

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Guesty Integration

Guesty credentials must stay server-side. The browser calls `/api/guesty` by default, and that serverless route requests Guesty inventory, checks configured two-unit groups, and returns combined stays to the React app.

Copy `.env.example` to `.env.local` for local configuration:

```bash
cp .env.example .env.local
```

Important variables:

```env
VITE_GUESTY_PROXY_URL=/api/guesty
GUESTY_API_MODE=booking
GUESTY_CLIENT_ID=
GUESTY_CLIENT_SECRET=
GUESTY_DEFAULT_COUNTRY=United States
GUESTY_COMBO_GROUPS=[{"id":"azure-six-bedroom","title":"Azure Resort 6-Bedroom Pairing","memberIds":["GUESTY_LISTING_ID_A","GUESTY_LISTING_ID_B"]}]
```

`GUESTY_COMBO_GROUPS` is the key agency-specific mapping. Each combo should list the two Guesty listing IDs that are near each other and safe to market together.

## Deployment Note

The included `api/guesty.js` route is suitable for serverless hosts such as Vercel. A static-only GitHub Pages deployment cannot run this route, so use `VITE_GUESTY_PROXY_URL` to point the frontend at a hosted backend if the site stays on GitHub Pages.

## Guesty References

- Guesty recommends the Booking Engine API for direct booking websites: https://open-api-docs.guesty.com/docs/moving-your-website-from-guestys-legacy-api-to-booking-engine-api
- Booking Engine API authentication: https://booking-api-docs.guesty.com/docs/authentication-1
- Booking Engine search parameters: https://booking-api-docs.guesty.com/docs/search-capabilities
