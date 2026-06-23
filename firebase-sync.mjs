// Firebase Realtime Database + Auth Integration for Notion Workspace
// Handles cloud backup, multi-device sync, Google Sign-In, and invite-based access control.

const OWNER_EMAIL = 'eewern21@gmail.com';

export async function initializeFirebaseSync(config) {
  try {
    // gstatic CDN — all modules share the same Firebase internal registry (required for RTDB + Auth)
    // Loaded via native <script type="module"> in index.html so Babel never sees these import() calls
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js');
    const { getDatabase, ref, set, get, onValue, remove, onDisconnect } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js');
    const {
      getAuth,
      GoogleAuthProvider,
      signInWithPopup,
      signOut: firebaseSignOut,
      onAuthStateChanged,
      setPersistence,
      browserLocalPersistence,
    } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js');

    if (!config?.firebaseApiKey) {
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

    // Avoid re-initialising if the SDK already has an app (e.g. hot-reload)
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    const database = getDatabase(app);
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();

    // Keep the user signed in across page refreshes (survives browser close/reopen)
    await setPersistence(auth, browserLocalPersistence);

    console.log('✅ Firebase initialized');

    // ── Helpers ────────────────────────────────────────────────────────────────

    // Access is keyed by Firebase UID (a clean, rules-safe identifier).
    // Email cannot be used as a DB key (contains '.'/'@') and Firebase rules
    // cannot sanitize it (no global .replace / no .split), so all rule checks
    // use auth.uid. Email is stored in the VALUE for display only.

    async function seedOwnerAccess(uid, email) {
      const snap = await get(ref(database, `access/${uid}`));
      if (!snap.exists()) {
        await set(ref(database, `access/${uid}`), {
          email: email.toLowerCase(),
          role: 'owner',
          addedAt: new Date().toISOString(),
        });
        console.log('✅ Owner access seeded');
      }
    }

    // Record every sign-in so the owner can see & approve people who request access.
    async function registerSignin(user) {
      if (!user?.uid) return;
      try {
        await set(ref(database, `signins/${user.uid}`), {
          email: (user.email || '').toLowerCase(),
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          lastSeen: new Date().toISOString(),
        });
      } catch (err) {
        // Non-fatal: signin registry is a convenience for the owner.
        console.warn('⚠️ Could not register sign-in:', err.message);
      }
    }

    // Cache the access check per signed-in UID so workspace autosaves do not
    // perform a Firebase read on every call. Reset automatically if a different
    // account signs in within the same browser session.
    let accessOkCacheUid = null;
    let accessOkCache = null;

    // ── Public API ─────────────────────────────────────────────────────────────
    return {
      database,
      ref,
      set,
      get,
      onValue,

      // ── Auth ────────────────────────────────────────────────────────────────

      async signInWithGoogle() {
        const result = await signInWithPopup(auth, provider);
        return result.user; // { email, displayName, uid, ... }
      },

      async signOut() {
        await firebaseSignOut(auth);
      },

      getCurrentUser() {
        return auth.currentUser;
      },

      onAuthStateChange(callback) {
        return onAuthStateChanged(auth, callback);
      },

      // ── Access control ──────────────────────────────────────────────────────

      // Accepts the full Firebase user object ({ uid, email, displayName, ... }).
      async checkUserAccess(user) {
        // Back-compat: tolerate being called with a bare email string.
        const uid = typeof user === 'string' ? null : user?.uid;
        const email = (typeof user === 'string' ? user : user?.email || '').toLowerCase();
        if (!uid) return null; // can't gate without a uid

        // Owner self-bootstrap (rules allow only the hardcoded owner email to do this).
        if (email === OWNER_EMAIL) {
          await seedOwnerAccess(uid, email);
          return { uid, email, role: 'owner' };
        }

        // Blocked users are denied — and we don't register their sign-in (no spam in pending).
        try {
          const blockedSnap = await get(ref(database, `blocked/${uid}`));
          if (blockedSnap.exists()) {
            console.warn('⛔ Sign-in denied — user is blocked');
            return { uid, email, role: 'blocked', blocked: true };
          }
        } catch {}

        await registerSignin(user);

        const snap = await get(ref(database, `access/${uid}`));
        return snap.exists() ? { uid, ...snap.val() } : null;
      },

      // Owner-only: full member list (keyed by uid, value has email/role).
      // Uses Promise.race with a 6s timeout so a rules-blocked read doesn't hang the UI.
      async getAccessList() {
        try {
          const snap = await Promise.race([
            get(ref(database, 'access')),
            new Promise((_, rej) => setTimeout(() => rej(new Error('access-list-timeout')), 6000)),
          ]);
          if (!snap.exists()) return [];
          return Object.entries(snap.val()).map(([uid, v]) => ({ uid, ...v }));
        } catch (err) {
          console.warn('⚠️ getAccessList failed:', err.message, '— deploy database.rules.json via Firebase Console to fix.');
          return [];
        }
      },

      // Owner-only: people who signed in but aren't approved members yet.
      // Blocked users are filtered out so they don't keep reappearing (anti-spam).
      async getPendingSignins() {
        try {
          const [signinsSnap, accessSnap, blockedSnap] = await Promise.all([
            Promise.race([get(ref(database, 'signins')), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))]),
            Promise.race([get(ref(database, 'access')), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))]),
            Promise.race([get(ref(database, 'blocked')), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))]).catch(() => null),
          ]);
          const signins = signinsSnap.exists() ? signinsSnap.val() : {};
          const access = accessSnap.exists() ? accessSnap.val() : {};
          const blocked = blockedSnap && blockedSnap.exists() ? blockedSnap.val() : {};
          const blockedEmails = new Set(Object.values(blocked).map((b) => (b?.email || '').toLowerCase()));
          return Object.entries(signins)
            .filter(([uid, v]) => !access[uid] && !blocked[uid] && !blockedEmails.has((v?.email || '').toLowerCase()))
            .map(([uid, v]) => ({ uid, ...v }));
        } catch (err) {
          console.warn('⚠️ getPendingSignins failed:', err.message);
          return [];
        }
      },

      // Owner-only: list of blocked users.
      async getBlockedUsers() {
        try {
          const snap = await Promise.race([
            get(ref(database, 'blocked')),
            new Promise((_, rej) => setTimeout(() => rej(new Error('blocked-list-timeout')), 6000)),
          ]);
          if (!snap.exists()) return [];
          return Object.entries(snap.val()).map(([uid, v]) => ({ uid, ...v }));
        } catch (err) {
          console.warn('⚠️ getBlockedUsers failed:', err.message);
          return [];
        }
      },

      // Owner-only: approve a user who has signed in.
      async grantAccess(uid, email, role = 'member') {
        await set(ref(database, `access/${uid}`), {
          email: (email || '').toLowerCase(),
          role: role === 'owner' ? 'owner' : 'member',
          addedAt: new Date().toISOString(),
        });
        // Clear their pending signin so the request disappears from the queue.
        try { await remove(ref(database, `signins/${uid}`)); } catch {}
        console.log(`✅ Granted ${role} access to ${email}`);
      },

      // Owner-only: revoke a member (keyed by uid).
      // Also clears their pending signin so a removed user does NOT reappear as pending.
      async revokeAccess(uid) {
        await remove(ref(database, `access/${uid}`));
        try { await remove(ref(database, `signins/${uid}`)); } catch {}
        console.log(`🗑️ Revoked access for ${uid}`);
      },

      // Owner-only: reject a pending request — removes it from the pending queue.
      // (They can sign in again later to re-request; use blockUser to stop repeat requests.)
      async rejectSignin(uid) {
        await remove(ref(database, `signins/${uid}`));
        console.log(`🚫 Rejected pending signin ${uid}`);
      },

      // Owner-only: block a user/email — removes access + pending, and keeps them out of
      // the pending queue on future sign-ins until unblocked.
      async blockUser(uid, email) {
        await set(ref(database, `blocked/${uid}`), {
          email: (email || '').toLowerCase(),
          blockedAt: new Date().toISOString(),
        });
        try { await remove(ref(database, `access/${uid}`)); } catch {}
        try { await remove(ref(database, `signins/${uid}`)); } catch {}
        console.log(`⛔ Blocked ${email || uid}`);
      },

      // Owner-only: unblock a user — they can request access again.
      async unblockUser(uid) {
        await remove(ref(database, `blocked/${uid}`));
        console.log(`✅ Unblocked ${uid}`);
      },

      // ── Workspace data ──────────────────────────────────────────────────────

      async saveWorkspace(workspaceId, workspaceData, saveId = null) {
        try {
          // Security: verify user is authenticated and in the access list before writing
          const currentUser = auth.currentUser;
          if (!currentUser?.uid) {
            console.warn('⚠️ Save blocked — user not authenticated');
            return false;
          }
          // Lightweight gate (the DB rules are the real enforcement).
          // Result is cached for the session — avoids a network round-trip on every save.
          if (accessOkCacheUid !== currentUser.uid) {
            accessOkCacheUid = currentUser.uid;
            accessOkCache = null;
          }
          if (accessOkCache === null) {
            const accessSnap = await get(ref(database, `access/${currentUser.uid}`));
            accessOkCache = accessSnap.exists() || currentUser.email?.toLowerCase() === OWNER_EMAIL;
          }
          if (!accessOkCache) {
            console.warn('⚠️ Save blocked — user not in access list');
            return false;
          }

          const dbRef = ref(database, `workspaces/${workspaceId}`);
          await set(dbRef, {
            workspace: workspaceData,   // full React state object
            updated_at: new Date().toISOString(),
            source: 'firebase',
            saveId,  // session ID — lets the listener ignore its own echoes
          });
          console.log(`✅ Saved workspace to Firebase: ${workspaceId}`);
          return true;
        } catch (error) {
          console.error(`❌ Failed to save workspace: ${error.message}`);
          return false;
        }
      },

      async loadWorkspace(workspaceId) {
        try {
          // Security: verify user is authenticated before reading
          const currentUser = auth.currentUser;
          if (!currentUser?.uid) {
            console.warn('⚠️ Load blocked — user not authenticated');
            return null;
          }
          // Lightweight gate (the DB rules are the real enforcement).
          const accessSnap = await get(ref(database, `access/${currentUser.uid}`));
          if (!accessSnap.exists() && currentUser.email?.toLowerCase() !== OWNER_EMAIL) {
            console.warn('⚠️ Load blocked — user not in access list');
            return null;
          }

          const dbRef = ref(database, `workspaces/${workspaceId}`);
          const snapshot = await get(dbRef);
          if (snapshot.exists()) {
            const record = snapshot.val();
            console.log(`✅ Loaded workspace from Firebase: ${workspaceId}`);
            return record; // { workspace: {...}, updated_at, source }
          }
          console.log(`ℹ️ No Firebase data for: ${workspaceId}`);
          return null;
        } catch (error) {
          console.error(`❌ Failed to load workspace: ${error.message}`);
          return null;
        }
      },

      onWorkspaceUpdate(workspaceId, callback) {
        try {
          const dbRef = ref(database, `workspaces/${workspaceId}`);
          const unsubscribe = onValue(dbRef, (snapshot) => {
            if (snapshot.exists()) callback(snapshot.val());
          });
          return unsubscribe;
        } catch (error) {
          console.error(`❌ Failed to set up real-time listener: ${error.message}`);
          return null;
        }
      },

      // Forcibly remove a workspace node from Firebase. Called during deletion to
      // guarantee the node is gone even if an in-flight save just wrote it back.
      async removeWorkspace(workspaceId) {
        if (!auth.currentUser) return;
        try {
          await remove(ref(database, `workspaces/${workspaceId}`));
          console.log(`🗑️ Removed workspace from Firebase: ${workspaceId}`);
        } catch (err) {
          console.warn('⚠️ Firebase workspace remove failed:', err.message);
        }
      },

      // ── Presence tracking (soft locks) ──────────────────────────────────────

      // NOTE: presence lives at a SEPARATE top-level node `presence/{workspaceId}/{sessionId}`,
      // keyed by BROWSER SESSION (not userId) so the same user in two tabs gets two locks
      // without overwriting each other.  Session ID is set by the app via sessionStorage.
      async setPresence(workspaceId, userId, blockId, email, meta = {}) {
        try {
          // Use per-tab session ID so two tabs of the same user don't cancel each other.
          const sessionId = meta.sessionId || userId;
          const presenceRef = ref(database, `presence/${workspaceId}/${sessionId}`);
          await set(presenceRef, {
            uid: userId,
            blockId,
            email: email || '',
            displayName: meta.displayName || '',
            photoURL: meta.photoURL || '',
            lastActivity: new Date().toISOString(),
          });
          // Auto-clear when tab disconnects — locks never linger after browser close.
          try { onDisconnect(presenceRef).remove(); } catch {}
        } catch (error) {
          console.warn(`⚠️ Failed to set presence: ${error.message}`);
        }
      },

      async clearPresence(workspaceId, userId, sessionId) {
        try {
          const key = sessionId || userId;
          const presenceRef = ref(database, `presence/${workspaceId}/${key}`);
          await remove(presenceRef);
        } catch (error) {
          console.warn(`⚠️ Failed to clear presence: ${error.message}`);
        }
      },

      // ── Claude MCP API Keys ─────────────────────────────────────────────────
      // Each user can hold one personal API key (stored at apiKeys/{uid}).
      // The key is used to authenticate MCP calls to the hosted API server.

      async generateApiKey() {
        const user = auth.currentUser;
        if (!user) throw new Error('Not signed in');
        // Format: wn_{first6ofUid}_{32 random hex chars}
        const rand = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map(b => b.toString(16).padStart(2, '0')).join('');
        const key = `wn_${user.uid.slice(0, 6)}_${rand}`;
        await set(ref(database, `apiKeys/${user.uid}`), {
          key,
          createdAt: new Date().toISOString(),
          email: user.email || '',
          displayName: user.displayName || '',
        });
        return key;
      },

      async getApiKey() {
        const user = auth.currentUser;
        if (!user) return null;
        const snap = await get(ref(database, `apiKeys/${user.uid}`));
        return snap.exists() ? snap.val().key : null;
      },

      async revokeApiKey() {
        const user = auth.currentUser;
        if (!user) return;
        await remove(ref(database, `apiKeys/${user.uid}`));
      },

      async saveWorkspaceList(list) {
        const user = auth.currentUser;
        if (!user) return;
        const clean = (list || []).map(({ id, name, updatedAt }) => ({ id, name, updatedAt: updatedAt || new Date().toISOString() }));
        await set(ref(database, `users/${user.uid}/workspace_list`), clean);
      },

      async loadWorkspaceList() {
        const user = auth.currentUser;
        if (!user) return null;
        const snap = await get(ref(database, `users/${user.uid}/workspace_list`));
        return snap.exists() ? snap.val() : null;
      },

      async submitFeedback(message, meta = {}) {
        const user = auth.currentUser;
        if (!user) throw new Error('Not signed in');
        const text = String(message || '').trim();
        if (!text) throw new Error('Feedback cannot be empty');
        const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await set(ref(database, `feedback/${user.uid}/${id}`), {
          message: text.slice(0, 4000),
          createdAt: new Date().toISOString(),
          email: user.email || '',
          displayName: user.displayName || '',
          page: meta.page || '',
          workspaceId: meta.workspaceId || '',
          userAgent: navigator.userAgent || '',
        });
        return id;
      },

      // onPresenceUpdate(workspaceId, callback, ownSessionId?)
      // Returns a map { blockId → { userId, email, ... } }.
      // Entries keyed by session (so same user in two tabs shows for both blocks).
      // ownSessionId is excluded so you never see your own lock.
      onPresenceUpdate(workspaceId, callback, ownSessionId) {
        try {
          const presenceRef = ref(database, `presence/${workspaceId}`);
          const unsubscribe = onValue(presenceRef, (snapshot) => {
            const rawPresence = snapshot.val() || {};
            const now = Date.now();
            const STALE_AFTER = 30 * 1000; // 30 seconds

            // Build a map: { blockId → { userId, email, sessionId } }
            // Last writer per block wins (fine — only one person should hold each lock).
            const byBlock = {};
            Object.entries(rawPresence).forEach(([sessionId, data]) => {
              if (!data?.blockId) return;
              if (ownSessionId && sessionId === ownSessionId) return; // skip own tab
              const lastActivity = new Date(data.lastActivity || 0).getTime();
              if (now - lastActivity > STALE_AFTER) return; // expired
              byBlock[data.blockId] = {
                userId: data.uid || sessionId,
                sessionId,
                email: data.email || sessionId,
                displayName: data.displayName || '',
                photoURL: data.photoURL || '',
              };
            });

            callback(byBlock);
          });
          return unsubscribe;
        } catch (error) {
          console.error(`❌ Failed to set up presence listener: ${error.message}`);
          return () => {};
        }
      },
    };
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    return null;
  }
}

export default initializeFirebaseSync;
