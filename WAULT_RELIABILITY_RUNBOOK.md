# WAULT Reliability Runbook

Production: `https://waults.vercel.app`

## Before Risky Work

```bash
cd "/Users/eewern/Desktop/WAULT v2"
npm run backup:firebase
npm run test:reliability
npm run test:firebase-reliability
```

Full exports are written to `firebase-exports/wault-firebase-YYYYMMDD-HHMMSS.json` and are intentionally ignored by Git because they contain real workspace data.

## Save States

- `Saving`: keep the tab open; the latest edit has not been acknowledged by Firebase yet.
- `Saved` / `Synced to cloud`: Firebase acknowledged the exact current snapshot.
- `Failed`: stop editing that workspace and recover before making more changes.

WAULT keeps the exact pending edit in a Firebase per-user draft and browser recovery storage until the same snapshot is acknowledged. A stale concurrent save is rejected by revision and merged before retrying.

## Recovery Order

1. Stop editing the affected workspace.
2. Confirm the URL is `https://waults.vercel.app` and the expected Google account is signed in.
3. Run `npm run backup:firebase` before restoring anything.
4. Inspect the current record at `workspaces/{workspaceId}`.
5. Inspect recovery sources in this order:
   - `workspaceDrafts/{workspaceId}/{uid}`
   - `workspaceVersions/{workspaceId}`
   - `workspaceBackups/{workspaceId}`
   - `workspaceDailyExports/{workspaceId}`
   - `workspaceTrash/{workspaceId}`
   - browser IndexedDB `wault_workspace_safety_v1`, store `snapshots`
   - browser keys `workspace_v4_pending_{workspaceId}` and `workspace_v4_backups_{workspaceId}`
6. Restore one verified workspace snapshot, never the entire database blindly.
7. Reload three times and confirm page count, important text, checklist state, and save status.

## Recovery Console

For the active, signed-in workspace:

```js
await WaultRecovery.listVersions(25)
await WaultRecovery.restoreVersion("VERSION_ID")
```

Restore creates another pre-save backup before replacing the current workspace.

## Release Gate

A reliability release is ready only after all of these pass:

- Secure build and JavaScript/JSX parsing.
- `npm run test:reliability`.
- `npm run test:firebase-reliability`, including synthetic cleanup.
- Signed-in browser: create, rename, switch, and soft-delete a test workspace.
- Signed-in browser: rapid typing, refresh, and cross-account readback.
- Signed-in browser: Focus individual delete, select all, bulk delete, workspace-side delete, and three reloads with no resurrection.
- Fresh Firebase export showing the real workspace catalogue unchanged.

## July 15 Reliability Checklist

Completed against a temporary authenticated Firebase member and an isolated workspace:

- [x] 34,014 deterministic assertions: save acknowledgements, stale workspace callbacks, crash-draft replay, concurrent block merge, deletion-wins merge, and subpage moves.
- [x] 164 live Firebase assertions through deployed database rules: compare-and-swap conflicts, 20 two-client collision rounds, 30 rapid saves, 20 sequential checklist deletes, stale-editor rejection, 100 Focus deletes, soft delete, history, backup, and synthetic cleanup.
- [x] Signed-in browser create, rename, and delete workspace; each state survived reload.
- [x] Rapid typing followed by immediate reload recovered the pending text and reached `Saved`.
- [x] Three reloads retained the saved marker.
- [x] Two signed-in tabs received realtime updates.
- [x] Concurrent edits to different blocks survived reload in both tabs.
- [x] Focus individual delete survived reload.
- [x] Focus group select-all and bulk delete survived reload.
- [x] Focus-to-workspace linked task delete removed both copies and survived reload.
- [x] Workspace-to-Focus linked task delete removed both copies and survived reload.
- [x] Workspace deletion removed the catalogue entry in both tabs and survived reload.
- [x] Owner team directory loaded approved teammates through Firebase rules, stayed populated after Refresh, and never rendered a read failure as an empty team.
- [x] A full database export before and after cleanup matched at every Firebase root; real workspace content, Focus, access, history, and catalogue hashes were unchanged.
- [x] Unchanged workspace snapshots no longer create Firebase revisions, versions, or backups.
- [x] Local UI tests are owner-scoped and cannot load real shared workspaces.

Evidence exports from this run:

- Before tests: `firebase-exports/wault-firebase-20260715-050026.json`
- Verified clean state after all UI tests: `firebase-exports/wault-firebase-20260715-055308.json`

These exports contain private workspace data and must stay outside Git.

## July 21 Cross-Browser Sync Incident

Root cause: localhost `?devpeek=1` could open an editable workspace without a Firebase-authenticated user. Those edits survived refresh in that browser's recovery storage but could not reach Firebase or another device. Shared `currentPageId` navigation and reused tab session IDs could also delay legitimate remote updates.

Release checks completed against one synthetic Firebase member on two isolated browser origins:

- [x] Signed-out localhost, including `?devpeek=1`, shows the Google sign-in gate and cannot edit.
- [x] A Firebase edit appeared in the second browser in real time.
- [x] The second browser received the edit while viewing a different page.
- [x] Page navigation created no Firebase revision, version, or backup.
- [x] A fresh mobile-sized sign-in with cleared app state loaded the Firebase value.
- [x] Twenty-five rapid edits converged to the same final value in both browsers.
- [x] Three consecutive reloads retained the final Firebase value.
- [x] Workspace create and soft-delete appeared and disappeared in the second browser.
- [x] Focus select-all selected all tasks; authenticated Firebase deletion coverage passed in the 168-assertion suite.
- [x] The three real workspace records matched the pre-test export byte-for-byte after synthetic cleanup.

Evidence exports:

- Before tests: `firebase-exports/wault-firebase-20260721-172112.json`
- Verified clean state after tests: `firebase-exports/wault-firebase-20260721-173904.json`

## If Data Looks Missing

1. Stop typing and do not delete or recreate the workspace.
2. Check that the save badge says `Saved`; photograph or note any `Failed` message.
3. Check the signed-in Google account and workspace name.
4. Run `npm run backup:firebase` before attempting recovery.
5. Record the affected page title, task text, approximate edit time, account email, and workspace.
6. Compare the live workspace with its draft, versions, pre-save backups, daily export, and trash record.
7. Restore only the verified workspace/version. Keep the current live snapshot as a backup first.
8. Confirm the restored text on two accounts and reload three times.
9. Do not clear browser storage; it may contain the fastest recovery copy.

No system can honestly promise that storage will never fail. WAULT's release gate is that a failed save remains visible, stale clients cannot overwrite newer revisions, unchanged loads cannot create writes, deletes cannot resurrect through merge, and every destructive change has a recovery source.

## Remaining Concurrency Limit

Different blocks and checklist items merge automatically. If two people edit the same field in the same block at the same moment, the current editor's value wins and the other value remains recoverable in version history. The presence indicator should be treated as the warning to avoid same-block simultaneous editing.
