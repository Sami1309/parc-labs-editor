# Render Deployment Guide

This repo is now set up to deploy to Render as a Node web service. Follow the steps below to launch and operate it.

## 1) Prerequisites
- GitHub/ GitLab repo with this code pushed (Render connects to your repo).
- Render account with Git provider linked.
- API keys ready: `GOOGLE_GENERATIVE_AI_API_KEY` (or `GEMINI_API_KEY`), `EXA_API_KEY`, `YOUTUBE_API_KEY`, `ELEVENLABS_API_KEY`.

## 2) One‑time Render setup
1. Push `render.yaml` to the default branch you want Render to deploy.
2. In Render dashboard: **New + → Blueprint**.
3. Connect the repo and pick the branch containing `render.yaml` (root path).
4. Review blueprint details; keep the generated Web Service named `gemini-test-2`.
5. Click **Apply** to create the service.

## 3) Environment variables (Render → Service → Environment)
Add these as **Secret** values (Render will mask them):
- `GOOGLE_GENERATIVE_AI_API_KEY` – Google Generative AI key (primary).
- `GEMINI_API_KEY` – optional alias; only set if you prefer this name.
- `EXA_API_KEY` – for research endpoints.
- `YOUTUBE_API_KEY` – for YouTube data fetches.
- `ELEVENLABS_API_KEY` – for text‑to‑speech.
- `NODE_VERSION` – already set to `20` in `render.yaml`; adjust only if needed.

## 4) What Render builds/runs
- Blueprint uses `npm ci && npm run build` then `npm run start`.
- Next.js output is `standalone` (see `next.config.ts`), so Render runs the compiled server under the `PORT` it provides.
- Health check path is `/`; change in `render.yaml` if you expose a dedicated endpoint.

## 5) Deploying & watching first build
1. After clicking **Apply**, Render installs deps and builds. This takes a few minutes.
2. On success, the service starts and a URL appears (e.g., `https://gemini-test-2.onrender.com`).
3. Visit the URL to verify the UI and hit an API route (e.g., `/api/research`) to confirm keys are working.
4. Check **Logs → Build** and **Logs → Runtime** if anything fails.

## 6) Ongoing deploys
- Every push to the tracked branch triggers a new deploy (auto‑deploy is enabled in `render.yaml`).
- Pull request previews are enabled; Render will spin up temporary preview services for PR branches.

## 7) Updating secrets or config
- Environment changes (new API key, etc.): Render → Service → Environment → **Add/Update Secret** → **Save** → **Manual Deploy** to pick up changes.
- If you edit `render.yaml` (build/start commands, health check, region), push to the branch; Render will re-read it on the next deploy.

## 8) IP Tracking & Unique Logins
The app includes a basic unique IP tracking system:
- **Mechanism**: Reads `X-Forwarded-For` header (correct for Render) in `RootLayout`.
- **Storage**: Logs unique IPs to `data/ip-logs.json`.
- **Visibility**:
  - Console logs: "ip_tracked" events appear in Render logs.
  - API: View stats at `/api/ip-stats`.
- **Important**: File-based storage (`data/` folder) is **ephemeral** on Render's free/standard web services. It will reset on every deploy or restart.
  - To persist this data, attach a Render Disk (requires paid plan) and mount it to `/opt/render/project/src/data` (or update `ip-tracker.ts` path).
  - Alternatively, use a managed database (Postgres) for production-grade persistence.

## 9) Local parity check (optional)
- Run `npm ci`, then `npm run build`, then `npm run start`; ensure it boots on `http://localhost:3000` before pushing.

That’s it—once the service is green on Render, the app is live on the provided URL.
