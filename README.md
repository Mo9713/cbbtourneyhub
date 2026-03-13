# TourneyHub

## Architecture: Feature-Sliced Design (FSD)

This project is organized according to the Feature-Sliced Design (FSD) methodology. This approach separates the application into standardized layers with a one-way data flow.

### Layer Definitions

1. **app**: The entry point of the application. It contains global providers, styles, and the primary routing logic (ViewRouter and AppShell).
2. **pages**: Compositional components that correspond to specific application routes. Pages are designed to be thin wrappers that render one or more widgets.
3. **widgets**: Complex UI blocks that combine multiple features and entities to form major sections of the interface (e.g., TournamentBracket, AdminBuilder).
4. **features**: Interactive units of business value (e.g., AuthForm, AddTournamentModal). Features handle specific user actions and local state related to those actions.
5. **entities**: Business logic and data models representing core domain concepts such as Tournaments, Picks, and Profiles.
6. **shared**: Reusable, domain-agnostic components and utilities. This includes UI primitives, mathematical helpers (bracketMath.ts), and infrastructure configuration (supabaseClient.ts).

## Tech Stack

* Frontend: React 18 with Vite
* Language: TypeScript
* State Management: Zustand for UI state and TanStack Query for server state synchronization
* Backend: Supabase for PostgreSQL, Authentication, and Realtime subscriptions
* Styling: Tailwind CSS

## Getting Started

### Prerequisites

* Node.js (version 18 or higher)
* NPM or an equivalent package manager

### Installation

1. Clone the repository to your local machine.
2. Install the necessary dependencies:

"npm install"

### Environment Configuration

The application requires a connection to a Supabase instance. Create a .env file in the root directory and provide the following environment variables:

"VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL"

"VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY"

### Execution

* Start the development server:
"npm run dev"

* Perform a static type check:
"npx tsc --noEmit"

* Generate a production build:
"npm run build"

## Project Standards

1. **Public APIs**: Every slice within the pages, widgets, features, and entities layers must export its public functionality through an index.ts file. Internal files should not be imported directly from outside the slice.
2. **Dependency Direction**: Modules are only permitted to import from layers positioned below them in the hierarchy (e.g., a feature can import an entity, but an entity cannot import a feature).
3. **Design System**: Reusable UI elements such as buttons, inputs, and modals should be maintained within the shared/ui directory to ensure visual consistency.