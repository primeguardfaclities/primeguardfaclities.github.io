# Prime Guard Facilities: GitHub Frontend + Vercel Backend + Supabase DB

## 1. Create the Supabase project
1. Sign in to Supabase and create a new project.
2. Wait for the database to finish provisioning.
3. Open the SQL Editor.
4. Paste the contents of `supabase/schema.sql` and run it.

This creates:
- `users`
- `attendance`
- default employee and manager records

## 2. Collect Supabase credentials
In Supabase, open `Project Settings -> API`.
Copy these values:
- `Project URL`
- `service_role` key

Use the `service_role` key only in Vercel server environment variables. Never put it in frontend files.

## 3. Deploy the backend on Vercel
1. Push this repository to GitHub.
2. In Vercel, click `Add New -> Project`.
3. Import this GitHub repository.
4. In the project settings, add these environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `PRIME_GUARD_ADMIN_USERNAME`
   - `PRIME_GUARD_ADMIN_PASSWORD`
   - `ALLOWED_ORIGINS`
5. Deploy.

Recommended `ALLOWED_ORIGINS` value:
- `https://yourdomain.com,https://your-github-pages-domain.github.io`

After deployment, your API base URL will look like:
- `https://your-vercel-project.vercel.app`

## 4. Point the GitHub frontend to the Vercel API
Edit `app-config.js` in your GitHub Pages frontend and set:

```js
window.PRIME_GUARD_CONFIG = {
  apiBaseUrl: "https://your-vercel-project.vercel.app"
};
```

Make sure every login/dashboard page loads `app-config.js` before `app-api.js`.

## 5. Push the frontend changes to GitHub Pages
Commit and push:
- `app-config.js`
- `app-api.js`
- HTML pages with the new script include
- backend `api/` files
- `vercel.json`
- `supabase/schema.sql`
- `.env.example`

## 6. Test the live flow
From your live domain:
1. Admin login
2. Manager login
3. Employee login
4. Add employee from admin page
5. Mark attendance from manager page
6. View attendance from admin and employee pages

## Default credentials
Admin credentials are controlled by Vercel environment variables.

Suggested defaults:
- Username: `admin`
- Password: `PrimeGuard@2026`

Seeded user credentials in Supabase:
- Employee: `employee` / `PrimeEmployee@2026`
- Guard: `guard1` / `Guard@2026`
- Rohtak manager: `manager` / `Manager@2026`
- New Delhi manager: `manager-delhi` / `ManagerDelhi@2026`
- Zirakpur manager: `manager-zirakpur` / `ManagerZirakpur@2026`

## Notes
- The current schema still stores passwords as plain text because it matches the existing frontend behavior.
- For production security, the next step should be password hashing and token-based sessions.
- The frontend remains static on GitHub Pages. All database access stays in Vercel server functions.
