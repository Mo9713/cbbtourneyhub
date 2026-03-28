# TourneyHub

A tournament management platform built with React and Supabase. It attempts to use Feature-Sliced Design (FSD) to keep the app organized and the data flow predictable.

### Tech Stack
- React 18 (Vite + TypeScript)
- Zustand (UI state) & TanStack Query (Server state)
- Supabase (Postgres, Auth, Realtime)
- Tailwind CSS

### Project Structure
The code is organized into layers to manage dependencies. If you're looking for something, it's likely in one of these:
- **app**: Providers, styles, and the AppShell.
- **pages**: Route-level wrappers.
- **widgets**: Large UI blocks (e.g., TournamentBracket, AdminBuilder).
- **features**: User actions and business logic (e.g., AuthForm).
- **entities**: Data models (Tournaments, Picks, Profiles).
- **shared**: UI primitives, bracketMath.ts, and the Supabase client.

### Setup
1. Install: npm install
2. Environment: Create a .env file in the root and add:
   VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
   VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
3. Commands: npm run dev to start, npm run build for production.