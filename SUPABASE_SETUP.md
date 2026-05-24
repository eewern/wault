# Supabase Setup

Version: v1.0  
Date: 2026-05-14

## What You Need To Do

1. Create a new Supabase project.
2. Open SQL Editor and run `supabase-schema.sql`.
3. Go to Authentication > URL Configuration.
4. Add your hosted app URL to the allowed redirect URLs. For local testing, add `http://127.0.0.1:4187/Company%20Workspace.html`.
5. Open Project Settings > API.
6. Copy the Project URL and anon public key.
7. Paste them into `workspace-config.js`.
8. Reload the website, enter your email in the sidebar sync panel, and sign in with the magic link.
9. Ask each teammate to sign in once. After that, invite them from the sidebar with their email.
10. Use the workspace selector at the top of the sidebar to switch workspaces. Use the `+` button beside it to create another workspace.

## Security Notes

- Never paste the Supabase service role key into `workspace-config.js`.
- The anon key is safe to use in the browser because access is enforced by Row Level Security.
- Workspace data is stored in `notion_workspaces.data` as JSON.
- Each workspace is a separate `notion_workspaces` row, so teams can keep multiple workspaces isolated.
- Only workspace members can read the workspace.
- Owners, admins, and editors can edit workspace data.
- Only owners and admins can invite teammates.

## Local Testing

The app can run as a static site:

```bash
cd "/Users/eewern/Downloads/Notion design"
python3 -m http.server 4187
```

Then open:

```text
http://127.0.0.1:4187/Company%20Workspace.html
```
