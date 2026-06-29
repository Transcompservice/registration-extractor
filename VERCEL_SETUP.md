# Registration Extractor — Vercel Setup Guide

This is a Next.js web app. You upload registration files in the browser, Claude AI reads the fields, and you click one button to send everything to Google Sheets.

---

## What You'll Need

- A [GitHub](https://github.com) account (free)
- A [Vercel](https://vercel.com) account (free) — sign up with GitHub
- An Anthropic API key
- A Google Cloud service account (for Sheets access)

---

## Step 1 — Get an Anthropic API Key

1. Go to https://console.anthropic.com → sign in
2. Click **API Keys** → **Create Key**
3. Copy it — starts with `sk-ant-`

---

## Step 2 — Set Up Google Sheets Access

### 2a — Create/open a Google Cloud Project
1. Go to https://console.cloud.google.com
2. Click the project dropdown → **New Project** → name it anything → **Create**

### 2b — Enable Google Sheets API
1. **APIs & Services → Library** → search **Google Sheets API** → **Enable**

### 2c — Create a Service Account
1. **APIs & Services → Credentials → Create Credentials → Service account**
2. Name it (e.g. `registration-extractor`) → **Done**
3. Click the account you just made → **Keys** tab → **Add Key → Create new key → JSON**
4. A JSON file downloads — keep it safe

### 2d — Share your Google Sheet with the service account
1. Open the downloaded JSON file in Notepad
2. Copy the `"client_email"` value (looks like `name@project.iam.gserviceaccount.com`)
3. Open your Google Sheet → **Share** → paste that email → role: **Editor** → **Send**

### 2e — Get the Spreadsheet ID
Your sheet URL:
`https://docs.google.com/spreadsheets/d/`**`THIS_IS_YOUR_ID`**`/edit`

Copy the bold part.

---

## Step 3 — Put the Code on GitHub

1. Go to https://github.com → click **+** → **New repository**
2. Name it `registration-extractor` → **Create repository**
3. Upload all the files from this folder to the repo
   - Tip: on the repo page, click **Add file → Upload files** and drag everything in

---

## Step 4 — Deploy to Vercel

1. Go to https://vercel.com → sign in with GitHub
2. Click **Add New → Project**
3. Select your `registration-extractor` repo → **Import**
4. Before clicking Deploy, click **Environment Variables** and add these four:

| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | Your `sk-ant-...` key |
| `GOOGLE_CREDENTIALS` | The **entire contents** of the JSON file you downloaded (paste it all on one line) |
| `SPREADSHEET_ID` | Your Google Sheet ID |
| `WORKSHEET_NAME` | The tab name, e.g. `Registrations` |

5. Click **Deploy** — done! Vercel gives you a live URL.

---

## Using the App

1. Open your Vercel URL
2. Drag and drop registration files (PDF, JPG, PNG — any mix)
3. Click **Extract Data** — Claude reads each file
4. Review the table
5. Click **Save to Google Sheets** — done!

---

## Cost

Each registration costs roughly $0.002–0.008 to process via Claude AI.
100 registrations ≈ $0.20–$0.80 total.

Vercel hosting is free for this level of usage.

---

## Troubleshooting

**"GOOGLE_CREDENTIALS parse error"**  
Make sure you pasted the entire JSON as one line with no line breaks.

**Permission denied writing to sheet**  
Confirm you shared the sheet with the service account email (Step 2d).

**File too large**  
The app supports files up to 20 MB. Compress the scan if larger.
