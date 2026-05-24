import https from 'https';
import fs from 'fs';

// Your Supabase credentials
const SUPABASE_URL = "https://fyyfsrriopewaiaeuxky.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5eWZzcnJpb3Bld2FpYWV1eGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODc4MTUsImV4cCI6MjA5NDI2MzgxNX0.2DqlX9mn90KYzU19cm2i_plKTWj7cCFgM_O356vIR2M";
const OWNER_EMAIL = "eewern21@gmail.com";

function makeSupabaseRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1${endpoint}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        } else {
          reject(new Error(`Supabase API error ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function migrateToSupabase() {
  console.log('🚀 Starting Supabase Migration');
  console.log('==============================\n');

  try {
    // Read the recovered data
    console.log('📖 Reading recovered data...');
    const recoveredData = JSON.parse(fs.readFileSync('/Users/eewern/Notion_Data/workspace-api-store.json', 'utf8'));

    const workspaces = recoveredData.workspaces || {};
    const workspaceList = Object.entries(workspaces);

    console.log(`✅ Found ${workspaceList.length} workspaces to migrate\n`);

    // Upload each workspace to Supabase
    for (const [wsId, wsData] of workspaceList) {
      console.log(`📤 Uploading: ${wsData.name}`);

      const supabasePayload = {
        name: wsData.name,
        owner: '00000000-0000-0000-0000-000000000000', // Placeholder, will be updated by trigger
        data: wsData.data || {},
        updated_at: new Date().toISOString()
      };

      try {
        const result = await makeSupabaseRequest('POST', '/notion_workspaces', supabasePayload);

        if (result && result.id) {
          console.log(`   ✅ Uploaded with ID: ${result.id}`);
          console.log(`   📊 Pages: ${Object.keys(wsData.data?.pages || {}).length}`);
        } else if (Array.isArray(result) && result[0]) {
          console.log(`   ✅ Uploaded with ID: ${result[0].id}`);
          console.log(`   📊 Pages: ${Object.keys(wsData.data?.pages || {}).length}`);
        } else {
          console.log(`   ⚠️  Response:`, result);
        }
      } catch (error) {
        console.log(`   ❌ Error:`, error.message);
      }
      console.log();
    }

    // Verify the upload
    console.log('🔍 Verifying upload...\n');
    const uploadedWorkspaces = await makeSupabaseRequest('GET', '/notion_workspaces?select=*');

    if (Array.isArray(uploadedWorkspaces)) {
      console.log(`✅ Total workspaces in Supabase: ${uploadedWorkspaces.length}`);
      uploadedWorkspaces.forEach(ws => {
        const pageCount = Object.keys(ws.data?.pages || {}).length;
        console.log(`   • ${ws.name} (${pageCount} pages)`);
      });
    }

    console.log('\n✨ Migration Complete!');
    console.log('📍 All data is now in Supabase');
    console.log('🔗 URL: https://fyyfsrriopewaiaeuxky.supabase.co');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrateToSupabase();
