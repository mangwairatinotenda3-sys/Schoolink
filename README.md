# Schoolink

A mobile-first social platform for schools, staff, parents and communities — built with React, Vite, Tailwind CSS, React Router, and Supabase.

Screens implemented: Welcome / Sign in, Email + Password sign-in (with real Supabase auth), Choose School Type, Choose Role, Home feed, Profile, Settings, Saved, Notifications, Add Post, and the Professional Dashboard.

## 1. Local setup

```bash
npm install
cp .env.example .env
# then edit .env with your Supabase project's URL and anon key
npm run dev
```

## 2. Supabase setup

1. Create a project at https://supabase.com.
2. Go to **Project Settings > API** and copy the **Project URL** and **anon public key** into your `.env` file (and later into your GitHub repo secrets — see below).
3. Go to **SQL Editor**, open `supabase/schema.sql` from this repo, paste it in, and run it. This creates the `profiles` and `posts` tables with row-level security policies.
4. (Optional) In **Authentication > Providers**, enable Google if you want the "Continue with Google" button to work — otherwise email/password sign-in works out of the box.

## 3. Deploying to GitHub Pages

This repo is set up at the **root** of your project (not nested in a subfolder), which is what you asked for.

1. Push this project to a GitHub repository.
2. In the repo, go to **Settings > Pages** and set **Source** to "GitHub Actions".
3. In **Settings > Secrets and variables > Actions**, add two repository secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Push to the `main` branch (or run the workflow manually from the **Actions** tab). The included workflow at `.github/workflows/deploy.yml` builds the app and publishes it to GitHub Pages automatically.
5. Your site will be live at `https://<your-username>.github.io/<repo-name>/`.

The app uses `HashRouter` and a relative Vite `base` path, so it works correctly under a GitHub Pages project subpath without any extra redirect configuration.

## Project structure

```
├── src/
│   ├── pages/          # One file per screen
│   ├── components/     # BottomNav, BackHeader
│   ├── context/         # AuthContext (Supabase session + profile)
│   └── lib/             # Supabase client
├── supabase/schema.sql  # Database schema + RLS policies
├── .github/workflows/   # GitHub Pages deploy workflow
└── vite.config.js
```

## Notes / next steps

- The Home feed and Add Post screen already read/write real rows in the `posts` table — post something and it'll show up for anyone signed in.
- Notifications, Groups & Communities, and most Settings rows are UI-only placeholders — wire them up to Supabase tables the same way `posts` is done whenever you're ready.
- Avatars are emoji placeholders; swap in Supabase Storage-hosted images when you add file uploads.
