import { create } from 'zustand';
import api from '../services/api';

const useCreditStore = create((set, get) => ({
  wallet: null,
  loading: false,
  error: null,

  loadWallet: async ({ silent = false } = {}) => {
    if (!silent) set({ loading: true });
    try {
      const { data } = await api.get('/billing/wallet');
      set({ wallet: data, loading: false, error: null });
      return data;
    } catch (error) {
      set({ loading: false, error });
      throw error;
    }
  },

  refreshWallet: () => get().loadWallet({ silent: true }),
  clearWallet: () => set({ wallet: null, loading: false, error: null }),
}));

export default useCreditStore;
