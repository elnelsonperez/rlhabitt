# RLHabitt Backend Repository Knowledge

## Project Overview
This repository contains a rental management application for short-term rentals. The business manages properties/apartments for multiple owners across various buildings. The app helps track reservations, buildings, apartments, and owners.

## Key Components

### Frontend Application
- React application with TypeScript
- Uses Supabase for backend and authentication
- Key UI component: `ReservationsGrid` - displays a calendar view of all reservations

### Database Schema
- **buildings**: Properties/complexes managed by the company
- **apartments**: Individual rental units within buildings (linked to owners)
- **owners**: Property owners who own the apartments
- **reservations**: Individual day bookings with rates and color coding
- **bookings**: Reservation groups that span multiple days (check-in/check-out)
- **guests**: People who make bookings
- **payment_sources**: Payment methods for bookings
- **color_meanings**: Color coding system for reservation status

### Python Backend (sheet_parser)
- Processes and imports reservation data from spreadsheets
- Provides API endpoints for data import and reservation management

## Key Features
1. Monthly reservation grid showing all apartments and their booking status
2. Color-coded reservations showing different booking statuses
3. Rate display for each reservation
4. Building selector to switch between different properties
5. Data import functionality from spreadsheets

## Technical Implementation
- React Query for data fetching
- TanStack Router for routing
- Tailwind CSS for styling
- Supabase for authentication and database
- TypeScript for type safety

## Command Reference
- Frontend: `cd app/frontend && npm run dev`
- Backend API: `cd sheet_parser && python -m src.api_server`