// localStorage-based persistence with cross-tab sync
// This prevents data loss when switching between tabs
(function () {
  const STORAGE_KEY = 'workspace_v4_current_data';
  const SYNC_INTERVAL = 500; // Save to localStorage every 500ms
  let pendingSave = null;
  let saveTimer = null;
  let lastSavedData = null;
  let listeners = { onSync: () => {} };

  // Listen for storage changes from other tabs
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        const remoteData = JSON.parse(event.newValue);
        // Only update if data is actually different
        if (JSON.stringify(remoteData) !== JSON.stringify(lastSavedData)) {
          lastSavedData = remoteData;
          listeners.onSync(remoteData);
        }
      } catch (error) {
        console.error('❌ Failed to parse storage sync:', error.message);
      }
    }
  });

  window.WorkspaceLocalStorage = {
    /**
     * Initialize the localStorage sync layer
     * @param {Function} onSync - Called when data is synced from other tabs
     */
    init(onSync) {
      listeners.onSync = onSync || (() => {});

      // Load initial data from localStorage
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          lastSavedData = JSON.parse(stored);
          return lastSavedData;
        }
      } catch (error) {
        console.error('❌ Failed to load from localStorage:', error.message);
      }

      return null;
    },

    /**
     * Queue data to be saved to localStorage
     * Uses debouncing to batch multiple saves
     * @param {Object} data - The workspace data to save
     */
    save(data) {
      pendingSave = data;

      // Clear existing timer
      if (saveTimer) clearTimeout(saveTimer);

      // Debounce saves - wait 500ms before actually saving
      saveTimer = setTimeout(() => {
        if (!pendingSave) return;

        try {
          const json = JSON.stringify(pendingSave);
          localStorage.setItem(STORAGE_KEY, json);
          lastSavedData = pendingSave;
          pendingSave = null;
          console.log('✅ Saved to localStorage');
        } catch (error) {
          console.error('❌ Failed to save to localStorage:', error.message);
          // Retry if quota exceeded
          if (error.name === 'QuotaExceededError') {
            console.warn('⚠️ localStorage quota exceeded, clearing old backups...');
            try {
              const keys = Object.keys(localStorage);
              keys.forEach(key => {
                if (key.includes('backup') && key !== STORAGE_KEY) {
                  localStorage.removeItem(key);
                }
              });
              // Retry save
              localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingSave));
              lastSavedData = pendingSave;
              console.log('✅ Saved after clearing backups');
            } catch (retryError) {
              console.error('❌ Still failed after clearing:', retryError.message);
            }
          }
        }
      }, SYNC_INTERVAL);
    },

    /**
     * Force immediate save (don't wait for debounce)
     * @param {Object} data - The workspace data to save
     */
    async saveNow(data) {
      if (saveTimer) clearTimeout(saveTimer);
      pendingSave = null;

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        lastSavedData = data;
        console.log('✅ Immediately saved to localStorage');
        return true;
      } catch (error) {
        console.error('❌ Failed to save immediately:', error.message);
        return false;
      }
    },

    /**
     * Get the last saved data
     */
    getLastSaved() {
      return lastSavedData;
    },

    /**
     * Check if there are pending changes
     */
    hasPending() {
      return pendingSave !== null;
    },
  };
})();
