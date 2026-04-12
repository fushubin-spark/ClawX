/**
 * Hermes Instances Store
 * Manages state for multiple Hermes instances
 */
import { create } from 'zustand';
import { hostApiFetch } from '@/lib/host-api';
import { invokeIpc } from '@/lib/api-client';

export interface HermesInstanceStatus {
  id: string;
  name: string;
  state: 'stopped' | 'starting' | 'running' | 'error';
  pid?: number;
  uptime?: number;
  model?: string;
  error?: string;
  hermesHome: string;
  color: string;
}

export interface HermesOutput {
  instanceId: string;
  line: string;
  stream: 'stdout' | 'stderr';
  timestamp: number;
}

interface HermesState {
  instances: HermesInstanceStatus[];
  selectedInstanceId: string | null;
  outputs: Record<string, string[]>;
  loading: boolean;
  error: string | null;

  // Actions
  fetchInstances: () => Promise<void>;
  selectInstance: (id: string | null) => void;
  addInstance: (name: string, hermesHome: string) => Promise<void>;
  removeInstance: (id: string) => Promise<void>;
  startInstance: (id: string) => Promise<void>;
  stopInstance: (id: string) => Promise<void>;
  restartInstance: (id: string) => Promise<void>;
  updateInstance: (id: string, name: string) => Promise<void>;
  refreshOutput: (id: string) => Promise<void>;
  injectCommand: (id: string, command: string) => Promise<void>;
  clearError: () => void;
}

export const useHermesStore = create<HermesState>((set, get) => ({
  instances: [],
  selectedInstanceId: null,
  outputs: {},
  loading: false,
  error: null,

  fetchInstances: async () => {
    set({ loading: true, error: null });
    try {
      const instances = await hostApiFetch<HermesInstanceStatus[]>('/api/hermes/instances');
      set({ instances: instances || [], loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  selectInstance: (id) => {
    set({ selectedInstanceId: id });
    if (id) {
      get().refreshOutput(id);
    }
  },

  addInstance: async (name, hermesHome) => {
    set({ error: null });
    try {
      const result = await hostApiFetch<{ success: boolean; config: HermesInstanceStatus }>('/api/hermes/instances', {
        method: 'POST',
        body: JSON.stringify({ name, hermesHome }),
      });
      if (result.success) {
        await get().fetchInstances();
      }
    } catch (err) {
      set({ error: String(err) });
    }
  },

  removeInstance: async (id) => {
    set({ error: null });
    try {
      await hostApiFetch(`/api/hermes/instances/${id}`, { method: 'DELETE' });
      set(state => ({
        instances: state.instances.filter(i => i.id !== id),
        selectedInstanceId: state.selectedInstanceId === id ? null : state.selectedInstanceId,
      }));
    } catch (err) {
      set({ error: String(err) });
    }
  },

  startInstance: async (id) => {
    set({ error: null });
    try {
      await hostApiFetch(`/api/hermes/instances/${id}/start`, { method: 'POST' });
      // Refresh status after starting
      setTimeout(() => get().fetchInstances(), 500);
    } catch (err) {
      set({ error: String(err) });
    }
  },

  stopInstance: async (id) => {
    set({ error: null });
    try {
      await hostApiFetch(`/api/hermes/instances/${id}/stop`, { method: 'POST' });
      setTimeout(() => get().fetchInstances(), 500);
    } catch (err) {
      set({ error: String(err) });
    }
  },

  restartInstance: async (id) => {
    set({ error: null });
    try {
      await hostApiFetch(`/api/hermes/instances/${id}/restart`, { method: 'POST' });
      setTimeout(() => get().fetchInstances(), 1000);
    } catch (err) {
      set({ error: String(err) });
    }
  },

  updateInstance: async (id, name) => {
    set({ error: null });
    try {
      await hostApiFetch(`/api/hermes/instances/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      await get().fetchInstances();
    } catch (err) {
      set({ error: String(err) });
    }
  },

  refreshOutput: async (id) => {
    try {
      const result = await hostApiFetch<{ output: string[] }>(
        `/api/hermes/instances/${id}/output?lines=200`
      );
      set(state => ({
        outputs: {
          ...state.outputs,
          [id]: result.output || [],
        },
      }));
    } catch (err) {
      console.error('Failed to fetch output:', err);
    }
  },

  injectCommand: async (id, command) => {
    set({ error: null });
    try {
      await hostApiFetch(`/api/hermes/instances/${id}/inject`, {
        method: 'POST',
        body: JSON.stringify({ command }),
      });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  clearError: () => set({ error: null }),
}));
