# RL HABITT Frontend

A modern React application for managing RL HABITT data. This application uses:

- React + TypeScript with Vite
- TanStack Router for type-safe routing with auth protection
- Zustand for lightweight state management
- TanStack Query for data fetching and caching
- Supabase for authentication

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your Supabase project details.

3. Run the development server:
   ```bash
   npm run dev
   ```

## Key Features

- **Authentication**: Login functionality with Supabase
- **Protected Routes**: Only authenticated users can access pages other than login
- **Type Safety**: Full TypeScript support throughout the app

## Project Structure

- `src/components/`: UI components
- `src/pages/`: Application pages
- `src/store/`: State management with Zustand
- `src/hooks/`: Custom React hooks
- `src/lib/`: Utilities and libraries (e.g., Supabase client)

## Authentication

The application uses Supabase for authentication. Login is handled by the `useAuthStore` Zustand store, which maintains session state and provides login/logout functionality.

## Routing

TanStack Router is used for routing with support for:
- Type-safe routes
- Auth protection via `beforeLoad` hooks
- Automatic redirection based on auth state

## Build and Deploy

To build for production:

```bash
npm run build
```

The built files will be in the `dist` directory, ready to be deployed to your hosting platform of choice.