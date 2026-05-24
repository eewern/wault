import https from 'https';

// Your Supabase credentials from workspace-config.js
const SUPABASE_URL = "https://fyyfsrriopewaiaeuxky.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5eWZzcnJpb3Bld2FpYWV1eGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODc4MTUsImV4cCI6MjA5NDI2MzgxNX0.2DqlX9mn90KYzU19cm2i_plKTWj7cCFgM_O356vIR2M";

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

async function recoverData() {
  console.log('🔄 Connecting to Supabase...');

  try {
    // Fetch all workspaces
    console.log('📦 Fetching workspaces...');
    const workspaces = await makeSupabaseRequest('GET', '/notion_workspaces?select=*');

    if (!Array.isArray(workspaces)) {
      throw new Error('Failed to fetch workspaces: ' + JSON.stringify(workspaces));
    }

    console.log(`✅ Found ${workspaces.length} workspace(s)\n`);

    const recoveredData = {
      timestamp: new Date().toISOString(),
      supabaseUrl: SUPABASE_URL,
      workspaces: []
    };

    for (const workspace of workspaces) {
      console.log(`📋 Workspace: ${workspace.name}`);
      console.log(`   ID: ${workspace.id}`);
      console.log(`   Owner: ${workspace.owner}`);
      console.log(`   Created: ${workspace.created_at}`);
      console.log(`   Updated: ${workspace.updated_at}`);
      console.log(`   Data size: ${JSON.stringify(workspace.data).length} bytes`);

      recoveredData.workspaces.push({
        id: workspace.id,
        name: workspace.name,
        owner: workspace.owner,
        created_at: workspace.created_at,
        updated_at: workspace.updated_at,
        data: workspace.data
      });

      console.log();
    }

    // Also fetch backups
    console.log('💾 Fetching backups...');
    const backups = await makeSupabaseRequest('GET', '/workspace_backups?select=*');

    if (Array.isArray(backups)) {
      console.log(`✅ Found ${backups.length} backup(s)\n`);
      recoveredData.backups = backups;
    }

    // Save to file
    const fs = await import('fs');
    const filePath = '/Users/eewern/Notion_Data/recovered-supabase-backup.json';

    // Ensure directory exists
    const dir = '/Users/eewern/Notion_Data';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(recoveredData, null, 2));

    console.log(`\n✨ Data successfully recovered!`);
    console.log(`📁 Saved to: ${filePath}`);
    console.log(`📊 Total data: ${JSON.stringify(recoveredData).length} bytes`);

    return recoveredData;
  } catch (error) {
    console.error('❌ Error recovering data:', error.message);
    process.exit(1);
  }
}

recoverData();
