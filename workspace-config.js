// Claude API bridge — base URL for the workspace API server.
// Default = the Railway-hosted API (works on the live site with the laptop off);
// add ?local to the URL to hit a local `npm run start:api` server during dev.
const LOCAL_ONLY_PREVIEW = new URLSearchParams(window.location.search).has("local");
window.WORKSPACE_API_URL = LOCAL_ONLY_PREVIEW
  ? "http://127.0.0.1:3334"
  : "https://wault-api-production.up.railway.app";
// Never place an API token in this public file. After Google sign-in the app
// supplies the signed-in user's revocable Firebase-backed key to the bridge in
// memory; the Railway master token remains server-side only.

// ⚠️ DISABLED: Supabase egress exceeded 5GB free limit, causing $0.125/GB overage charges
// Switched to Firebase (unlimited API calls, no egress limits)
window.SUPABASE_CONFIG = LOCAL_ONLY_PREVIEW ? {
  url: "",
  anonKey: "",
  workspaceName: "My Workspace",
  ownerEmail: "wernahhh@gmail.com",
} : {
  url: "", // DISABLED - was causing egress charges
  anonKey: "", // DISABLED - was causing egress charges
  workspaceName: "My Workspace",
  ownerEmail: "wernahhh@gmail.com",
  // Firebase config - fully configured ✅
  firebaseApiKey: "AIzaSyDfXPu4ZdQTHYPmF5qUdaI-O7wttjD7qoQ",
  firebaseAuthDomain: "wernotion.firebaseapp.com",
  firebaseProjectId: "wernotion",
  firebaseDatabaseURL: "https://wernotion-default-rtdb.asia-southeast1.firebasedatabase.app",
};
