# HCM Lite — Saylani Hackathon

AI-assisted Human Capital Management system built with React, Express, MongoDB, JWT and optional hosted LLM API.

## Features in this starter
- First-run company/Admin setup; JWT login; Admin, HR and Employee roles
- Company settings and departments
- Employee directory and HR registration (creates employee login)
- Web attendance check-in/out
- Leave request, balance and HR approval/rejection
- Monthly payroll draft and Admin finalization lock
- Role-scoped dashboards, announcements, audit feed
- AI chat with safe database-backed tools and optional OpenAI-compatible API
- Responsive dashboard UI

This is a hackathon starter implementation. Optional CSV import/export, PDF payslip downloads, camera/geofence attendance, detailed analytics filters, notifications, and some advanced policy/reporting features may need further implementation before claiming all 25 checklist items complete. Review the checklist in the brief and test each workflow before submission.

## Requirements
- Node.js 20+
- MongoDB local or hosted
- Optional OpenAI-compatible API key for AI chat

## Run locally
### 1. Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```
Edit `backend/.env`: set `MONGODB_URI`, `JWT_SECRET`, and optionally `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL`.

### 2. Frontend
In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173. On first run choose **Set up company** to create the first Admin account.

## Deployment
- Deploy backend as a Node web service; set `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`.
- Deploy frontend as a static site; set `VITE_API_URL` to backend URL plus `/api`.
- Configure `CLIENT_ORIGIN` to the frontend URL.
- Never commit `.env` or real credentials. Commit `.env.example` only.

## Demo accounts
Create your own accounts from the first-run setup. HR creates employees from the directory screen. Do not use hardcoded demo data; the database starts empty.

## Important
This is a substantial hackathon brief. The code is a working foundation, not a certification that every brief item has been fully implemented. Test the core flows end-to-end and be transparent about incomplete items in your submission.

## Current implementation notes
The project implements the primary end-to-end setup, authentication, employee creation, check-in/out, leave approval, payroll draft/finalization, dashboards, announcements, audit log and an AI assistant fallback. Review the source for limitations before judging. In particular, the PDF payslip export, CSV import/export and dry-run validation, full attendance correction approval UI, detailed dashboard filters/charts, smart leave natural-language prefill, camera/face/location attendance, and full notifications UI are not complete in this version. Do not represent those items as finished.
