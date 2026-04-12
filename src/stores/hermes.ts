/**
 * Hermes Instances Store
 * Manages state for multiple Hermes instances
 */
import { create } from 'zustand';

// Check if we're running inside Electron with IPC
function isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electron?.ipcRenderer;
}

// Safe API call - only runs in Electron
async function safeApiFetch(url: string, options?: RequestInit): Promise<any> {
  if (!isElectron()) {
    console.warn('[HermesStore] Not in Electron context, skipping API call:', url);
    return null;
  }
  // Dynamic import to avoid crashing the module on browser
  const { hostApiFetch } = await import('@/lib/host-api');
  return hostApiFetch(url, options);
}

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
      const instances = await safeApiFetch('/api/hermes/instances');
      set({ instances: instances || [], loading: false });
    } catch (err) {
      console.warn('[HermesStore] fetchInstances failed:', err);
      set({ instances: [], loading: false });
    }
  },

  selectInstance: (id) => {
    set({ selectedInstanceId: id });
    if (id) get().refreshOutput(id);
  },

  addInstance: async (name, hermesHome) => {
    set({ error: null });
    try {
      const result = await safeApiFetch('/api/hermes/instances', {
        method: 'POST',
        body: JSON.stringify({ name, hermesHome }),
      });
      if (result?.success) await get().fetchInstances();
    } catch (err) {
      console.warn('[HermesStore] addInstance failed:', err);
      set({ error: String(err) });
    }
  },

  removeInstance: async (id) => {
    set({ error: null });
    try {
      await safeApiFetch(`/api/hermes/instances/${id}`, { method: 'DELETE' });
      set(state => ({
        instances: state.instances.filter(i => i.id !== id),
        selectedInstanceId: state.selectedInstanceId === id ? null : state.selectedInstanceId,
      }));
    } catch (err) {
      console.warn('[HermesStore] removeInstance failed:', err);
      set({ error: String(err) });
    }
  },

  startInstance: async (id) => {
    set({ error: null });
    try {
      await safeApiFetch(`/api/hermes/instances/${id}/start`, { method: 'POST' });
      setTimeout(() => get().fetchInstances(), 500);
    } catch (err) {
      console.warn('[HermesStore] startInstance failed:', err);
      set({ error: String(err) });
    }
  },

  stopInstance: async (id) => {
    set({ error: null });
    try {
      await safeApiFetch(`/api/hermes/instances/${id}/stop`, { method: 'POST' });
      setTimeout(() => get().fetchInstances(), 500);
    } catch (err) {
      console.warn('[HermesStore] stopInstance failed:', err);
      set({ error: String(err) });
    }
  },

  restartInstance: async (id) => {
    set({ error: null });
    try {
      await safeApiFetch(`/api/hermes/instances/${id}/restart`, { method: 'POST' });
      setTimeout(() => get().fetchInstances(), 1000);
    } catch (err) {
      console.warn('[HermesStore] restartInstance failed:', err);
      set({ error: String(err) });
    }
  },

  updateInstance: async (id, name) => {
    set({ error: null });
    try {
      await safeApiFetch(`/api/hermes/instances/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      await get().fetchInstances();
    } catch (err) {
      console.warn('[HermesStore] updateInstance failed:', err);
      set({ error: String(err) });
    }
  },

  refreshOutput: async (id) => {
    try {
      const result = await safeApiFetch(`/api/hermes/instances/${id}/output?lines=200`);
      if (result) {
        set(state => ({
          outputs: {
            ...state.outputs,
            [id]: result.output || [],
          },
        }));
      }
    } catch (err) {
      console.warn('[HermesStore] refreshOutput failed:', err);
    }
  },

  injectCommand: async (id, command) => {
    set({ error: null });
    try {
      await safeApiFetch(`/api/hermes/instances/${id}/inject`, {
        method: 'POST',
        body: JSON.stringify({ command }),
      });
    } catch (err) {
      console.warn('[HermesStore] injectCommand failed:', err);
      set({ error: String(err) });
    }
  },

  clearError: () => set({ error: null }),
}));
