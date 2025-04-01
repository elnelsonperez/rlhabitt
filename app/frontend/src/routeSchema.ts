// Defines the schemas for route params to avoid circular dependencies
export interface ReservationsSearchParams {
  buildingId?: string;
  year?: string;
  month?: string;
}

export const validateReservationsSearch = (search: Record<string, unknown>) => {
  return {
    buildingId: search.buildingId as string | undefined,
    year: search.year as string | undefined,
    month: search.month as string | undefined
  };
};