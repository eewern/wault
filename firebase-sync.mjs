// Firebase Realtime Database Integration for Notion Workspace
// This module handles syncing workspace data to/from Firebase

export async function initializeFirebaseSync(config) {
  try {
    // Dynamically import Firebase SDK
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js');
    const { getDatabase, ref, set, get, onValue } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js');

    if (!config.firebaseApiKey) {
      console.warn('⚠️ Firebase not configured (missing API key)');
      return null;
    }

    const firebaseConfig = {
      apiKey: config.firebaseApiKey,
      authDomain: config.firebaseAuthDomain,
      projectId: config.firebaseProjectId,
      databaseURL: config.firebaseDatabaseURL,
    };

    console.log('🔥 Initializing Firebase...');
    const app = initializeApp(firebaseConfig);
    const database = getDatabase(app);

    console.log('✅ Firebase initialized successfully');
    console.log(`📍 Database: ${config.firebaseDatabaseURL}`);

    return {
      database,
      ref,
      set,
      get,
      onValue,

      // Save workspace to Firebase
      async saveWorkspace(workspaceId, workspaceData) {
        try {
          const dbRef = ref(database, `workspaces/${workspaceId}`);
          await set(dbRef, {
            name: workspaceData.name,
            data: workspaceData.data,
            updated_at: new Date().toISOString(),
            source: 'firebase'
          });
          console.log(`✅ Saved workspace: ${workspaceId}`);
          return true;
        } catch (error) {
          console.error(`❌ Failed to save workspace: ${error.message}`);
          return false;
        }
      },

      // Load workspace from Firebase
      async loadWorkspace(workspaceId) {
        try {
          const dbRef = ref(database, `workspaces/${workspaceId}`);
          const snapshot = await get(dbRef);
          if (snapshot.exists()) {
            const data = snapshot.val();
            console.log(`✅ Loaded workspace: ${workspaceId}`);
            return data;
          } else {
            console.log(`ℹ️ Workspace not found: ${workspaceId}`);
            return null;
          }
        } catch (error) {
          console.error(`❌ Failed to load workspace: ${error.message}`);
          return null;
        }
      },

      // List all workspaces
      async listWorkspaces() {
        try {
          const dbRef = ref(database, 'workspaces');
          const snapshot = await get(dbRef);
          if (snapshot.exists()) {
            const workspaces = snapshot.val();
            console.log(`✅ Found ${Object.keys(workspaces).length} workspaces`);
            return workspaces;
          } else {
            console.log('ℹ️ No workspaces found');
            return {};
          }
        } catch (error) {
          console.error(`❌ Failed to list workspaces: ${error.message}`);
          return {};
        }
      },

      // Listen for real-time updates
      onWorkspaceUpdate(workspaceId, callback) {
        try {
          const dbRef = ref(database, `workspaces/${workspaceId}`);
          return onValue(dbRef, (snapshot) => {
            if (snapshot.exists()) {
              callback(snapshot.val());
            }
          });
        } catch (error) {
          console.error(`❌ Failed to set up listener: ${error.message}`);
          return null;
        }
      }
    };
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    return null;
  }
}

export default initializeFirebaseSync;
