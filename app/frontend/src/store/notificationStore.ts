import { create } from 'zustand';

// Define the notification store state
interface NotificationState {
  pendingCommunicationsCount: number;
  setPendingCommunicationsCount: (count: number) => void;
}

// Create the store
export const useNotificationStore = create<NotificationState>((set) => ({
  pendingCommunicationsCount: 0,
  setPendingCommunicationsCount: (count: number) => set({ pendingCommunicationsCount: count }),
}));