# AIG Engineering Pulse — Server-Side Proxy Setup

## Architecture
```
Tablet → Netlify Function (/api/graph) → Microsoft Graph API → OneDrive/SharePoint
```
Credentials (client secret) live **only** in Netlify environment variables.
The browser never sees the secret.

---

## Azure App Registration (server-side, NOT a SPA)

1. Go to **portal.azure.com** → App registrations → **New registration**
2. Name: `AIG Pulse Server`
3. Supported account types: **Single tenant**
4. **No redirect URI** needed (server-to-server, no user login)
5. Click **Register**

### Add a Client Secret
1. Certificates & secrets → **New client secret**
2. Description: `netlify-proxy`, Expires: 24 months
3. **Copy the Value immediately** (shown only once)

### API Permissions (Application permissions, NOT Delegated)
Add these **Application** permissions from Microsoft Graph:
- `Files.ReadWrite.All`
- `Sites.ReadWrite.All`
- `Mail.Send`
- `User.Read.All`

Click **Grant admin consent** → Yes

### Note down:
- **Application (client) ID** → MS_CLIENT_ID
- **Directory (tenant) ID** → MS_TENANT_ID
- **Client secret value** → MS_CLIENT_SECRET

---

## Netlify Environment Variables

In Netlify UI → Site settings → Environment variables, add:

| Variable | Value |
|---|---|
| `MS_TENANT_ID` | Your Azure AD tenant ID |
| `MS_CLIENT_ID` | Your app registration client ID |
| `MS_CLIENT_SECRET` | Your client secret value |
| `MS_DRIVE_ID` | `b!veoMpeHXtkmoTGQ9h11a5DgxDM_TPnZKsNCZXzA2V25MzM_CgqavS7Ofw-5lWpiC` |
| `ALLOWED_ORIGINS` | `https://pulse-aigengineering.netlify.app` |

---

## Deploy

### Option A — Drag & drop (easiest)
1. Zip the entire folder: `netlify-proxy.zip`
2. Go to app.netlify.com → your site → **Deploys**
3. Drag the zip into the deploy area

### Option B — Netlify CLI
```bash
npm install -g netlify-cli
cd netlify-proxy
netlify deploy --prod --site pulse-aigengineering
```

---

## How login works now

Instead of Microsoft OAuth popup, users enter their **work email address**.
The server looks them up in Azure AD and returns their profile.
No popup, no redirect — works perfectly on tablets.

---

## File structure
```
netlify-proxy/
├── netlify.toml              ← Netlify config
├── package.json
├── netlify/
│   └── functions/
│       └── graph.js          ← Server-side proxy (credentials here)
└── public/
    └── index.html            ← Portal (no secrets)
```
