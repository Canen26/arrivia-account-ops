# Account Operations Request Form — Setup Guide

## What's in this folder

| File | Purpose |
|---|---|
| `index.html` | The form UI (open this in a browser after the server is running) |
| `server.js` | Node.js backend — creates ADO tickets and sends emails |
| `package.json` | Node.js dependency list |
| `.env` | Your private config (create this from `.env.example`) |
| `logo.png` | **Replace this file** with the Arrivia logo |

---

## Step 1 — Install Node.js

Download and install Node.js (LTS version) from:  
https://nodejs.org

After installing, close and reopen any terminal windows.

---

## Step 2 — Create your .env file

1. Copy `.env.example` to `.env` (in the same folder)
2. Fill in each value:

```
ADO_PAT=<your Azure DevOps Personal Access Token>
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@arrivia.com         ← or any Arrivia mailbox you can send from
SMTP_PASS=<password or app password>
SMTP_FROM=noreply@arrivia.com
PORT=3000
```

### How to create an ADO Personal Access Token
1. Go to https://dev.azure.com/arrivia
2. Click your profile icon → **Personal Access Tokens**
3. Click **New Token**
4. Set **Organization** = arrivia, **Expiration** = your choice
5. Under **Scopes**, select **Work Items → Read & Write**
6. Copy the token and paste it into `.env` as `ADO_PAT`

---

## Step 3 — Add your logo

Place the Arrivia logo image file in this folder and name it `logo.png`.  
Supported formats: PNG, JPG, SVG (rename it to `logo.png`).

---

## Step 4 — Install dependencies and start the server

Open a terminal (Command Prompt or PowerShell) in this folder and run:

```
npm install
npm start
```

You should see:  
`Server running at http://localhost:3000`

---

## Step 5 — Open the form

Open a browser and go to:  
**http://localhost:3000**

---

## Hosting (for shared access)

To make the form accessible to your team without running it on your laptop:

- **Azure App Service** — deploy this Node.js app (free tier available)
- **IIS on an internal server** — install the iisnode module
- **Simple option:** Run `npm start` on any always-on Windows server on your network and share the URL `http://<server-ip>:3000`

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "ADO_PAT not set" or 401 error | Check your PAT in `.env`, make sure Work Items scope is enabled |
| Email not sending | Verify SMTP credentials; for Office 365 you may need an App Password if MFA is enabled |
| Logo not showing | Make sure the file is named exactly `logo.png` and is in the same folder as `index.html` |
| Form loads but submit fails | Open browser DevTools (F12) → Console for error details |
