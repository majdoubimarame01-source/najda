import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AlertRow, Profile } from './supabase';

export type Sensitivity = 'low' | 'normal' | 'high';
export const SENSITIVITY_G: Record<Sensitivity, number> = { low: 3.2, normal: 2.7, high: 2.2 };

type State = {
  hydrated: boolean;
  me: Profile | null;
  offline: boolean; // profile picked without a Supabase session/network
  pinHash: string | null;
  demoMode: boolean;
  demoRole: 'victim' | 'helper';
  walkMode: boolean;
  sensitivity: Sensitivity;
  members: Profile[];
  // Alerts kept in memory: own active alert + circle alerts (and local/offline ones).
  alerts: Record<string, AlertRow>;
  myActiveAlertId: string | null;
  checkOpen: boolean;

  set: (p: Partial<State>) => void;
  upsertAlert: (a: AlertRow) => void;
  logout: () => void;
};

export const useApp = create<State>()(
  persist(
    (set) => ({
      hydrated: false,
      me: null,
      offline: false,
      pinHash: null,
      demoMode: true,
      demoRole: 'victim',
      walkMode: false,
      sensitivity: 'normal',
      members: [],
      alerts: {},
      myActiveAlertId: null,
      checkOpen: false,
      set: (p) => set(p),
      upsertAlert: (a) => set((s) => ({ alerts: { ...s.alerts, [a.id]: { ...s.alerts[a.id], ...a } } })),
      logout: () =>
        set({ me: null, offline: false, members: [], alerts: {}, myActiveAlertId: null, walkMode: false }),
    }),
    {
      name: 'najda-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        me: s.me,
        offline: s.offline,
        pinHash: s.pinHash,
        demoMode: s.demoMode,
        demoRole: s.demoRole,
        sensitivity: s.sensitivity,
        myActiveAlertId: s.myActiveAlertId,
        members: s.members,
      }),
      onRehydrateStorage: () => () => useApp.setState({ hydrated: true }),
    },
  ),
);

export const getApp = () => useApp.getState();
