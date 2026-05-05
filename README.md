# Job Tracker

A personal job application tracker that scans Gmail and parses emails with Claude AI.

**Live:** https://job-tracker-six-lilac.vercel.app

## Stack
Vite + React + TypeScript + Supabase + Vercel + Anthropic Claude API

## Local dev
```bash
npm install
vercel env pull .env.local
vercel dev
```
Open `http://localhost:3000`

> Use `vercel dev` not `npm run dev` — Gmail scan needs the serverless function.

## How Gmail scan works
1. Click Scan Gmail → Google OAuth popup
2. Serverless function reads Gmail (last 7 days, Job Applications label)
3. Claude API extracts company, role, status, date
4. New entries added to Supabase, duplicates skipped

## Env vars needed
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ANTHROPIC_API_KEY`
