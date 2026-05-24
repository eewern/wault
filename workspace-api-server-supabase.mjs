import http from 'http';
import { createClient } from '@supabase/supabase-js';

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = "https://fyyfsrriopewaiaeuxky.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5eWZzcnJpb3Bld2FpYWV1eGt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODc4MTUsImV4cCI6MjA5NDI2MzgxNX0.2DqlX9mn90KYzU19cm2i_plKTWj7cCFgM_O356vIR2M";

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Read JSON body
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Send JSON response
function sendJson(res, data, statusCode = 200) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// API Routes
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // GET /api/workspaces - List all workspaces
    if (method === 'GET' && path === '/api/workspaces') {
      const { data, error } = await supabase
        .from('notion_workspaces')
        .select('*');

      if (error) throw error;

      return sendJson(res, data || []);
    }

    // GET /api/workspaces/:id - Get specific workspace
    if (method === 'GET' && path.match(/^\/api\/workspaces\/[^\/]+$/)) {
      const id = path.split('/').pop();
      const { data, error } = await supabase
        .from('notion_workspaces')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return sendJson(res, data || {});
    }

    // POST /api/workspaces - Create workspace
    if (method === 'POST' && path === '/api/workspaces') {
      const body = await readBody(req);
      const { data, error } = await supabase
        .from('notion_workspaces')
        .insert([{
          name: body.name || 'My Workspace',
          data: body.data || {},
          owner: body.owner || '00000000-0000-0000-0000-000000000000'
        }])
        .select();

      if (error) throw error;
      return sendJson(res, data?.[0] || {}, 201);
    }

    // PUT /api/workspaces/:id - Update workspace
    if (method === 'PUT' && path.match(/^\/api\/workspaces\/[^\/]+$/)) {
      const id = path.split('/').pop();
      const body = await readBody(req);
      const { data, error } = await supabase
        .from('notion_workspaces')
        .update({
          data: body.data || {},
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select();

      if (error) throw error;
      return sendJson(res, data?.[0] || {});
    }

    // DELETE /api/workspaces/:id - Delete workspace
    if (method === 'DELETE' && path.match(/^\/api\/workspaces\/[^\/]+$/)) {
      const id = path.split('/').pop();
      const { error } = await supabase
        .from('notion_workspaces')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return sendJson(res, { success: true });
    }

    // POST /api/workspaces/:id/blocks - Add block
    if (method === 'POST' && path.match(/^\/api\/workspaces\/[^\/]+\/blocks$/)) {
      const id = path.split('/')[3];
      const body = await readBody(req);

      // Get current workspace
      const { data: workspace, error: getError } = await supabase
        .from('notion_workspaces')
        .select('data')
        .eq('id', id)
        .single();

      if (getError) throw getError;

      // Add block to workspace data
      const updated = { ...workspace.data };
      if (!updated.pages) updated.pages = {};
      const pageId = body.pageId || Object.keys(updated.pages)[0];
      if (pageId && updated.pages[pageId]) {
        updated.pages[pageId].blocks = updated.pages[pageId].blocks || [];
        updated.pages[pageId].blocks.push(body.block);
      }

      // Update workspace
      const { data, error } = await supabase
        .from('notion_workspaces')
        .update({ data: updated, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select();

      if (error) throw error;
      return sendJson(res, { success: true, workspace: data?.[0] }, 201);
    }

    // 404
    return sendJson(res, { error: 'Not found' }, 404);

  } catch (error) {
    console.error('Error:', error);
    return sendJson(res, { error: error.message }, 500);
  }
}

// Start server
const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`🚀 Notion Workspace API Server (Supabase)`);
  console.log(`📊 Data source: Supabase`);
  console.log(`🔗 URL: https://fyyfsrriopewaiaeuxky.supabase.co`);
  console.log(`🌐 Listening on http://localhost:${PORT}`);
  console.log(`\n✅ Ready for requests`);
});
