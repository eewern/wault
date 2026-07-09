// Firebase Realtime Database + Auth Integration for Notion Workspace
// Handles cloud backup, multi-device sync, Google Sign-In, and invite-based access control.

const OWNER_EMAILS = ['wernahhh@gmail.com', 'eewern21@gmail.com'];
const isOwnerEmail = (email = '') => OWNER_EMAILS.includes(String(email || '').toLowerCase());

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

    const workspaceCatalogPath = (workspaceId) => `workspaceCatalog/${workspaceId}`;
    const normalizeVisibility = (visibility) => visibility === 'private' ? 'private' : 'shared';
    const cleanWorkspaceName = (name, fallback = 'Untitled Workspace') => {
      const text = String(name || '').trim();
      return text || fallback;
    };
    const summarizeWorkspaceData = (workspace) => {
      const pages = workspace?.pages && typeof workspace.pages === 'object' ? workspace.pages : {};
      let blocks = 0;
      let checklistItems = 0;
      let approxChars = 0;
      Object.values(pages).forEach((page) => {
        (page?.blocks || []).forEach((block) => {
          blocks += 1;
          if (Array.isArray(block.items)) checklistItems += block.items.length;
          try { approxChars += JSON.stringify(block).length; } catch {}
        });
      });
      return {
        pages: Object.keys(pages).length,
        blocks,
        checklistItems,
        approxChars,
        hasUnavailablePage: !!pages.cloud_workspace_unavailable,
      };
    };
    const isDangerousWorkspaceOverwrite = (existingWorkspace, nextWorkspace, metadata = {}) => {
      if (metadata.allowDangerousOverwrite === true) return false;
      const before = summarizeWorkspaceData(existingWorkspace);
      const after = summarizeWorkspaceData(nextWorkspace);
      if (after.hasUnavailablePage) return true;
      if (before.pages >= 2 && after.pages <= 1) return true;
      if (before.approxChars > 5000 && after.approxChars < Math.max(1000, before.approxChars * 0.25)) return true;
      if (before.blocks >= 20 && after.blocks < Math.max(3, before.blocks * 0.25)) return true;
      return false;
    };
    async function writeAuditLog(action, workspaceId, payload = {}) {
      try {
        const user = auth.currentUser;
        const now = new Date().toISOString();
        await set(ref(database, `workspaceAuditLogs/${workspaceId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}`), {
          action,
          created_at: now,
          uid: user?.uid || '',
          email: String(user?.email || '').toLowerCase(),
          workspaceId,
          ...payload,
        });
      } catch (err) {
        console.warn(`⚠️ Audit log failed (${action}): ${err.message}`);
      }
    }
    const canSeeWorkspaceCatalogEntry = (meta, user = auth.currentUser) => {
      if (!meta || meta.deleted === true) return false;
      if (normalizeVisibility(meta.visibility) !== 'private') return true;
      return !!(user?.uid && meta.ownerUid === user.uid);
    };

    async function loadWorkspaceCatalogEntry(workspaceId) {
      if (!workspaceId) return null;
      const snap = await get(ref(database, workspaceCatalogPath(workspaceId)));
      if (!snap.exists()) return null;
      const meta = snap.val() || {};
      return {
        id: meta.id || workspaceId,
        name: cleanWorkspaceName(meta.name, workspaceId),
        visibility: normalizeVisibility(meta.visibility),
        ownerUid: meta.ownerUid || '',
        ownerEmail: meta.ownerEmail || '',
        updatedAt: meta.updatedAt || '',
        deleted: meta.deleted === true,
      };
    }

    async function upsertWorkspaceCatalogEntry(workspaceId, patch = {}) {
      const currentUser = auth.currentUser;
      if (!currentUser?.uid || !workspaceId) {
        throw new Error('Not signed in');
      }
      const existing = await loadWorkspaceCatalogEntry(workspaceId);
      const visibility = normalizeVisibility(patch.visibility ?? existing?.visibility ?? 'shared');
      const ownerUid = existing?.ownerUid || patch.ownerUid || currentUser.uid;
      const ownerEmail = existing?.ownerEmail || patch.ownerEmail || currentUser.email || '';
      if (visibility === 'private' && ownerUid !== currentUser.uid) {
        throw new Error('Private workspaces can only be managed by their owner.');
      }
      const next = {
        ...(existing || {}),
        id: workspaceId,
        name: cleanWorkspaceName(patch.name ?? existing?.name, workspaceId),
        visibility,
        ownerUid,
        ownerEmail: String(ownerEmail || '').toLowerCase(),
        updatedAt: new Date().toISOString(),
        deleted: patch.deleted === undefined ? !!existing?.deleted : patch.deleted === true,
      };
      await set(ref(database, workspaceCatalogPath(workspaceId)), next);
      return next;
    }

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

        // A DB read that can't reach the server must never hang the sign-in gate.
        // Race every access read against a timeout so the UI always resolves.
        const withTimeout = (promise, ms, label) =>
          Promise.race([
            promise,
            new Promise((_, rej) => setTimeout(() => rej(new Error(label + '-timeout')), ms)),
          ]);

        // Owner self-bootstrap (rules allow only the hardcoded owner email to do this).
        // The seed is bookkeeping only — fire-and-forget so a stalled RTDB write can
        // never block the owner from entering their own workspace.
        if (isOwnerEmail(email)) {
          seedOwnerAccess(uid, email).catch((e) => console.warn('⚠️ Owner seed failed (non-fatal):', e.message));
          return { uid, email, role: 'owner' };
        }

        // Blocked users are denied — and we don't register their sign-in (no spam in pending).
        try {
          const blockedSnap = await withTimeout(get(ref(database, `blocked/${uid}`)), 3000, 'blocked');
          if (blockedSnap.exists()) {
            console.warn('⛔ Sign-in denied — user is blocked');
            return { uid, email, role: 'blocked', blocked: true };
          }
        } catch {}

        registerSignin(user).catch(() => {});

        try {
          const snap = await withTimeout(get(ref(database, `access/${uid}`)), 3000, 'access');
          return snap.exists() ? { uid, ...snap.val() } : null;
        } catch (err) {
          console.warn('⚠️ Access read failed:', err.message);
          return null; // treat as "not approved yet" rather than hang
        }
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

      async saveWorkspace(workspaceId, workspaceData, saveId = null, metadata = {}) {
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
            accessOkCache = accessSnap.exists() || isOwnerEmail(currentUser.email);
          }
          if (!accessOkCache) {
            console.warn('⚠️ Save blocked — user not in access list');
            return false;
          }

          const existingSnap = await get(ref(database, `workspaces/${workspaceId}`));
          const existingRecord = existingSnap.exists() ? (existingSnap.val() || {}) : null;
          if (existingRecord?.workspace && isDangerousWorkspaceOverwrite(existingRecord.workspace, workspaceData, metadata)) {
            await writeAuditLog('save_blocked_dangerous_overwrite', workspaceId, {
              path: `workspaces/${workspaceId}`,
              saveId: saveId || '',
              existingSummary: summarizeWorkspaceData(existingRecord.workspace),
              nextSummary: summarizeWorkspaceData(workspaceData),
              baseUpdatedAt: metadata.baseUpdatedAt || '',
            });
            console.warn(`🛑 Save blocked — refusing to overwrite real workspace with empty/default data: ${workspaceId}`);
            return { ok: false, blocked: true, reason: 'dangerous_overwrite' };
          }
          const baseUpdatedAt = metadata.baseUpdatedAt || "";
          if (existingRecord?.updated_at && baseUpdatedAt) {
            const remoteMs = Date.parse(existingRecord.updated_at) || 0;
            const baseMs = Date.parse(baseUpdatedAt) || 0;
            if (remoteMs > baseMs && existingRecord.saveId !== saveId) {
              await writeAuditLog('save_blocked_stale_revision', workspaceId, {
                path: `workspaces/${workspaceId}`,
                saveId: saveId || '',
                existingUpdatedAt: existingRecord.updated_at || '',
                baseUpdatedAt,
                existingSummary: summarizeWorkspaceData(existingRecord.workspace),
                nextSummary: summarizeWorkspaceData(workspaceData),
              });
              console.warn(`⚠️ Save blocked — Firebase has a newer workspace revision: ${workspaceId}`);
              return { ok: false, blocked: true, reason: 'stale_revision' };
            }
          }

          const updatedAt = new Date().toISOString();
          const previousSummary = summarizeWorkspaceData(existingRecord?.workspace);
          const nextSummary = summarizeWorkspaceData(workspaceData);
          if (existingRecord?.workspace) {
            try {
              await set(ref(database, `workspaceBackups/${workspaceId}/${Date.now()}`), {
                workspace: existingRecord.workspace,
                updated_at: existingRecord.updated_at || '',
                backed_up_at: updatedAt,
                saveId: existingRecord.saveId || '',
                summary: previousSummary,
              });
            } catch (backupError) {
              console.warn(`⚠️ Workspace backup failed before save (${workspaceId}): ${backupError.message}`);
            }
          }

          await upsertWorkspaceCatalogEntry(workspaceId, {
            name: metadata.name || workspaceData?.settings?.workspaceName || workspaceId,
            visibility: metadata.visibility,
            ownerUid: metadata.ownerUid,
            ownerEmail: metadata.ownerEmail,
            deleted: false,
          });

          const dbRef = ref(database, `workspaces/${workspaceId}`);
          await set(dbRef, {
            workspace: workspaceData,   // full React state object
            updated_at: updatedAt,
            source: 'firebase',
            saveId,  // session ID — lets the listener ignore its own echoes
            summary: nextSummary,
          });
          const versionPayload = {
            workspace: workspaceData,
            updated_at: updatedAt,
            saveId: saveId || '',
            uid: currentUser.uid,
            email: String(currentUser.email || '').toLowerCase(),
            summary: nextSummary,
            base_updated_at: metadata.baseUpdatedAt || '',
          };
          try {
            await set(ref(database, `workspaceVersions/${workspaceId}/${Date.now()}`), versionPayload);
            await set(ref(database, `workspaceDailyExports/${workspaceId}/${updatedAt.slice(0, 10)}`), versionPayload);
          } catch (versionError) {
            console.warn(`⚠️ Workspace version history failed (${workspaceId}): ${versionError.message}`);
          }
          await writeAuditLog(existingRecord?.workspace ? 'workspace_update' : 'workspace_create', workspaceId, {
            path: `workspaces/${workspaceId}`,
            saveId: saveId || '',
            previousUpdatedAt: existingRecord?.updated_at || '',
            updatedAt,
            previousSummary,
            nextSummary,
          });
          console.log(`✅ Saved workspace to Firebase: ${workspaceId}`);
          return { ok: true, updated_at: updatedAt };
        } catch (error) {
          console.error(`❌ Failed to save workspace: ${error.message}`);
          return false;
        }
      },

      async saveWorkspaceDraft(workspaceId, workspaceData, saveId = null, metadata = {}) {
        try {
          const currentUser = auth.currentUser;
          if (!currentUser?.uid) {
            console.warn('⚠️ Draft save blocked — user not authenticated');
            return false;
          }
          if (accessOkCacheUid !== currentUser.uid) {
            accessOkCacheUid = currentUser.uid;
            accessOkCache = null;
          }
          if (accessOkCache === null) {
            const accessSnap = await get(ref(database, `access/${currentUser.uid}`));
            accessOkCache = accessSnap.exists() || isOwnerEmail(currentUser.email);
          }
          if (!accessOkCache) {
            console.warn('⚠️ Draft save blocked — user not in access list');
            return false;
          }
          const savedAt = new Date().toISOString();
          const summary = summarizeWorkspaceData(workspaceData);
          await set(ref(database, `workspaceDrafts/${workspaceId}/${currentUser.uid}`), {
            workspace: workspaceData,
            saved_at: savedAt,
            base_updated_at: metadata.baseUpdatedAt || '',
            saveId,
            email: String(currentUser.email || '').toLowerCase(),
            summary,
          });
          await writeAuditLog('workspace_draft_save', workspaceId, {
            path: `workspaceDrafts/${workspaceId}/${currentUser.uid}`,
            saveId: saveId || '',
            savedAt,
            summary,
          });
          return { ok: true, saved_at: savedAt };
        } catch (error) {
          console.warn(`⚠️ Failed to save workspace draft: ${error.message}`);
          return false;
        }
      },

      async loadWorkspaceDraft(workspaceId) {
        try {
          const currentUser = auth.currentUser;
          if (!currentUser?.uid) return null;
          const snap = await get(ref(database, `workspaceDrafts/${workspaceId}/${currentUser.uid}`));
          return snap.exists() ? (snap.val() || null) : null;
        } catch (error) {
          console.warn(`⚠️ Failed to load workspace draft: ${error.message}`);
          return null;
        }
      },

      async clearWorkspaceDraft(workspaceId) {
        try {
          const currentUser = auth.currentUser;
          if (!currentUser?.uid) return false;
          await remove(ref(database, `workspaceDrafts/${workspaceId}/${currentUser.uid}`));
          await writeAuditLog('workspace_draft_clear', workspaceId, {
            path: `workspaceDrafts/${workspaceId}/${currentUser.uid}`,
          });
          return true;
        } catch (error) {
          console.warn(`⚠️ Failed to clear workspace draft: ${error.message}`);
          return false;
        }
      },

      async listWorkspaceVersions(workspaceId, limit = 25) {
        try {
          const currentUser = auth.currentUser;
          if (!currentUser?.uid) return [];
          const snap = await get(ref(database, `workspaceVersions/${workspaceId}`));
          if (!snap.exists()) return [];
          return Object.entries(snap.val() || {})
            .map(([id, row]) => ({
              id,
              updated_at: row.updated_at || '',
              email: row.email || '',
              uid: row.uid || '',
              saveId: row.saveId || '',
              summary: row.summary || summarizeWorkspaceData(row.workspace),
            }))
            .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
            .slice(0, Math.max(1, Math.min(Number(limit) || 25, 100)));
        } catch (error) {
          console.warn(`⚠️ Failed to list workspace versions: ${error.message}`);
          return [];
        }
      },

      async restoreWorkspaceVersion(workspaceId, versionId) {
        try {
          const currentUser = auth.currentUser;
          if (!currentUser?.uid) throw new Error('Not signed in');
          const snap = await get(ref(database, `workspaceVersions/${workspaceId}/${versionId}`));
          if (!snap.exists()) throw new Error('Version not found');
          const version = snap.val() || {};
          if (!version.workspace?.pages) throw new Error('Version has no workspace data');
          await writeAuditLog('workspace_restore_requested', workspaceId, {
            path: `workspaceVersions/${workspaceId}/${versionId}`,
            versionId,
            versionUpdatedAt: version.updated_at || '',
            summary: version.summary || summarizeWorkspaceData(version.workspace),
          });
          return await this.saveWorkspace(workspaceId, version.workspace, `restore_${Date.now()}`, {
            name: version.workspace?.settings?.workspaceName || workspaceId,
            visibility: 'shared',
            baseUpdatedAt: '',
            allowDangerousOverwrite: true,
            restoredFromVersion: versionId,
          });
        } catch (error) {
          console.error(`❌ Failed to restore workspace version: ${error.message}`);
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
          if (!accessSnap.exists() && !isOwnerEmail(currentUser.email)) {
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

      async loadWorkspaceCatalogEntry(workspaceId) {
        try {
          return await loadWorkspaceCatalogEntry(workspaceId);
        } catch (error) {
          console.warn(`⚠️ Failed to load workspace catalogue entry: ${error.message}`);
          return null;
        }
      },

      async updateWorkspaceCatalog(workspaceId, patch = {}) {
        try {
          return await upsertWorkspaceCatalogEntry(workspaceId, patch);
        } catch (error) {
          console.error(`❌ Failed to update workspace catalogue: ${error.message}`);
          throw error;
        }
      },

      // List the whole team workspace catalogue straight from Firebase. The
      // /workspaceCatalog node has a node-level .read for approved users (every
      // workspace is shared), so the browser no longer needs the Railway API to
      // discover workspaces. Returns lightweight summaries; content is loaded
      // separately via loadWorkspace().
      async listAllWorkspaces() {
        const user = auth.currentUser;
        if (!user?.uid) return [];
        try {
          const snap = await get(ref(database, 'workspaceCatalog'));
          if (!snap.exists()) return [];
          const rows = Object.values(snap.val() || {}).filter((w) => w && w.id);
          const deletedWorkspaceIds = rows.filter((w) => w.deleted === true).map((w) => w.id);
          const list = rows
            .filter((w) => canSeeWorkspaceCatalogEntry(w, user))
            .map((w) => ({
              id: w.id,
              name: cleanWorkspaceName(w.name, w.id),
              visibility: normalizeVisibility(w.visibility),
              ownerUid: w.ownerUid || '',
              ownerEmail: String(w.ownerEmail || '').toLowerCase(),
              updatedAt: w.updatedAt || '',
              createdAt: w.createdAt || '',
            }));
          list.deletedWorkspaceIds = deletedWorkspaceIds;
          return list;
        } catch (error) {
          console.warn(`⚠️ Failed to list workspace catalogue: ${error.message}`);
          throw error;
        }
      },

      // Live subscription to the team catalogue. Replaces the old 8s Railway poll.
      // Fires the callback with the same summary shape as listAllWorkspaces().
      onWorkspaceCatalogUpdate(callback) {
        try {
          const user = auth.currentUser;
          const dbRef = ref(database, 'workspaceCatalog');
          const unsubscribe = onValue(dbRef, (snapshot) => {
            const val = snapshot.exists() ? (snapshot.val() || {}) : {};
            const rows = Object.values(val).filter((w) => w && w.id);
            const deletedWorkspaceIds = rows.filter((w) => w.deleted === true).map((w) => w.id);
            const list = rows
              .filter((w) => canSeeWorkspaceCatalogEntry(w, user))
              .map((w) => ({
                id: w.id,
                name: cleanWorkspaceName(w.name, w.id),
                visibility: normalizeVisibility(w.visibility),
                ownerUid: w.ownerUid || '',
                ownerEmail: String(w.ownerEmail || '').toLowerCase(),
                updatedAt: w.updatedAt || '',
                createdAt: w.createdAt || '',
              }));
            list.deletedWorkspaceIds = deletedWorkspaceIds;
            callback(list, deletedWorkspaceIds);
          }, (error) => {
            // Permission/connection errors must NOT silently hang the catalogue.
            // Surface them and hand back an empty list so the app falls back to its
            // cached workspace list instead of waiting forever.
            console.warn(`⚠️ Catalogue listener error (${error?.message || error}); using cached list`);
            try { callback([]); } catch {}
          });
          return unsubscribe;
        } catch (error) {
          console.error(`❌ Failed to set up catalogue listener: ${error.message}`);
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
        if (!auth.currentUser) throw new Error('Not signed in');
        try {
          const existingSnap = await get(ref(database, `workspaces/${workspaceId}`));
          const existingRecord = existingSnap.exists() ? (existingSnap.val() || {}) : null;
          const deletedAt = new Date().toISOString();
          if (existingRecord?.workspace) {
            const summary = summarizeWorkspaceData(existingRecord.workspace);
            await set(ref(database, `workspaceTrash/${workspaceId}/${Date.now()}`), {
              ...existingRecord,
              deleted_at: deletedAt,
              deleted_by_uid: auth.currentUser.uid,
              deleted_by_email: String(auth.currentUser.email || '').toLowerCase(),
              summary,
            });
            await set(ref(database, `workspaces/${workspaceId}`), {
              ...existingRecord,
              deleted: true,
              deleted_at: deletedAt,
              deleted_by_uid: auth.currentUser.uid,
              updated_at: deletedAt,
              summary,
            });
            await writeAuditLog('workspace_soft_delete', workspaceId, {
              path: `workspaces/${workspaceId}`,
              deletedAt,
              summary,
            });
          }
          try { await remove(ref(database, `presence/${workspaceId}`)); } catch {}
          await upsertWorkspaceCatalogEntry(workspaceId, { deleted: true });
          console.log(`🗑️ Soft-deleted workspace in Firebase: ${workspaceId}`);
          return true;
        } catch (err) {
          console.warn('⚠️ Firebase workspace remove failed:', err.message);
          throw err;
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

      async saveWorkspaceList(list, activeWorkspaceId = "", deletedWorkspaceIds = []) {
        const user = auth.currentUser;
        if (!user) return;
        // Legacy compatibility only. The signed-in workspace catalogue now lives
        // at /workspaceCatalog and is filtered by the Railway API; per-user
        // workspace lists must not be the source of truth anymore.
        await set(ref(database, `users/${user.uid}/active_workspace`), activeWorkspaceId || "");
      },

      async loadWorkspaceList() {
        const user = auth.currentUser;
        if (!user) return null;
        const [activeSnap] = await Promise.all([
          get(ref(database, `users/${user.uid}/active_workspace`)).catch(() => null),
        ]);
        return {
          workspaces: [],
          activeWorkspaceId: activeSnap && activeSnap.exists() ? activeSnap.val() : "",
          deletedWorkspaceIds: [],
        };
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
