# DentFlow SaaS — Dental Clinic Management

Production-ready dental clinic SaaS application built with React + Node.js + PostgreSQL.

**Stack**: Neon PostgreSQL · Render (backend) · Vercel (frontend)

---

## Running Locally

### Backend
```bash
cd backend
cp .env.example .env   # Fill in your Neon DATABASE_URL, JWT_SECRET
npm install
npm start              # Auto-creates tables on first run if DB is empty
```

### Frontend
```bash
cd app
npm install
npm run dev
```

Default admin login: `admin@dentflow.com` / `Admin@1234`

> **Note**: On first startup, the backend automatically checks if tables exist in Neon.
> If they don't, it runs `schema.sql` to create all tables and seed demo data.
> This is fully idempotent — it does nothing if tables already exist.

---

## Deployment

### Step 1: Database (Neon PostgreSQL)
1. Go to [neon.tech](https://neon.tech) and create a project.
2. Copy the **connection string** from: Dashboard → Connection Details → Connection String.
   - Format: `postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require`
3. Save this — you'll use it as `DATABASE_URL` on Render.

> No manual schema setup needed. The backend auto-initializes tables on first startup.

### Step 2: Backend (Render)
1. Create a **Web Service** on [render.com](https://render.com).
2. Connect your GitHub repository.
3. Configure:
   - **Root Directory**: `backend`
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add Environment Variables:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Neon connection string from Step 1 |
   | `JWT_SECRET` | A strong random string (64+ chars) |
   | `NODE_ENV` | `production` |
   | `CORS_ORIGIN` | Your Vercel URL (e.g., `https://dentflow.vercel.app`) |

5. Deploy. Save the Render URL (e.g., `https://dentflow-api.onrender.com`).

> On first deploy, the backend will auto-create all database tables. No Shell access needed.

### Step 3: Frontend (Vercel)
1. Import your GitHub repository on [vercel.com](https://vercel.com).
2. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `app`
3. Add Environment Variable:

   | Variable | Value |
   |---|---|
   | `VITE_API_URL` | `https://your-render-url.onrender.com/api` |

4. Deploy.

### Step 4: Post-deploy
1. Update `CORS_ORIGIN` on Render to match your actual Vercel URL.
2. Test: visit your Vercel URL, login, and check the public booking page.

---

## Git Commands

```bash
git init
git add .
git commit -m "feat: production-ready DentFlow with Neon + Render + Vercel"
git branch -M main
git remote add origin https://github.com/YourUsername/DentFlow.git
git push -u origin main
```

---

## Environment Variables Summary

### Render (Backend)
| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Random secret for JWT signing |
| `NODE_ENV` | ✅ | Set to `production` |
| `CORS_ORIGIN` | ✅ | Vercel frontend URL |

### Vercel (Frontend)
| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | ✅ | Render backend URL + `/api` |

---

## Health Check

Backend exposes `GET /api/health` — returns:
```json
{ "success": true, "message": "OK", "timestamp": "..." }
```

Use this as the Render health check endpoint.
