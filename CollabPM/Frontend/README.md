# CollabPM Frontend

Next.js (App Router) + React, plain JavaScript, CSS Modules.

## Run it

You need Node 18+ (`node --version`).

```bash
cd Frontend
npm install      # first time only, installs Next/React
npm run dev      # starts the dev server on http://localhost:3000
```

Make sure the Flask backend is running on http://localhost:5000 (see ../Backend).
The API address is set in `.env.local` (NEXT_PUBLIC_API_BASE_URL).

## Structure

- `app/` - routes (App Router). Each folder with a `page.js` is a URL.
  - `app/page.js` - home
  - `app/login`, `app/register` - auth pages
  - `app/builder` - the recursive work-breakdown builder
- `lib/` - non-UI helpers: `api.js` (fetch wrapper + token), `auth.js` (auth calls), `tree.js` (immutable tree operations)
- `components/` - reusable UI: `AuthForm`, `Box` (recursive), `BoxBuilder`
