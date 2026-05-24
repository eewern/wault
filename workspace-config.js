// ⚠️ DISABLED: Supabase egress exceeded 5GB free limit, causing $0.125/GB overage charges
// Switched to Firebase (unlimited API calls, no egress limits)
const LOCAL_ONLY_PREVIEW = new URLSearchParams(window.location.search).has("local");
window.SUPABASE_CONFIG = LOCAL_ONLY_PREVIEW ? {
  url: "",
  anonKey: "",
  workspaceName: "My Workspace",
  ownerEmail: "eewern21@gmail.com",
} : {
  url: "", // DISABLED - was causing egress charges
  anonKey: "", // DISABLED - was causing egress charges
  workspaceName: "My Workspace",
  ownerEmail: "eewern21@gmail.com",
  // Firebase config - fully configured ✅
  firebaseApiKey: "AIzaSyDfXPu4ZdQTHYPmF5qUdaI-O7wttjD7qoQ",
  firebaseAuthDomain: "wernotion.firebaseapp.com",
  firebaseProjectId: "wernotion",
  firebaseDatabaseURL: "https://wernotion-default-rtdb.asia-southeast1.firebasedatabase.app",
};
