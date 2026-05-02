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

Guesty credentials must stay server-side. The browser calls `/api/guesty` by default, and that serverless route requests Guesty inventory and returns your already-combined Guesty listings to the React app.

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
GUESTY_LISTING_IDS=
GUESTY_LISTING_TAG=
```

The site assumes the listings returned from Guesty are already the combined, guest-facing listings. `GUESTY_LISTING_IDS` and `GUESTY_LISTING_TAG` are optional filters in case the Guesty account also contains listings that should not appear on the public website.

## Deployment Note

The included `api/guesty.js` route is suitable for serverless hosts such as Vercel. A static-only GitHub Pages deployment cannot run this route, so use `VITE_GUESTY_PROXY_URL` to point the frontend at a hosted backend if the site stays on GitHub Pages.

## Guesty References

- Guesty recommends the Booking Engine API for direct booking websites: https://open-api-docs.guesty.com/docs/moving-your-website-from-guestys-legacy-api-to-booking-engine-api
- Booking Engine API authentication: https://booking-api-docs.guesty.com/docs/authentication-1
- Booking Engine search parameters: https://booking-api-docs.guesty.com/docs/search-capabilities
