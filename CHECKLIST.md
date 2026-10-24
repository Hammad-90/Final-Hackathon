# Brief coverage and remaining work

Implemented foundations:
- First-run company/Admin creation, JWT login, password hashing, role-guarded APIs
- Company settings, departments, employee registration and temporary login
- Employee self profile, attendance check-in/out and attendance listing
- Leave apply, balance calculation, HR decision, cancellation of pending requests
- Payroll draft, illustrative tax brackets, Admin finalize/lock
- Server-calculated headline dashboard metrics, announcements, audit log
- AI endpoint with role-aware data fallback and optional hosted OpenAI-compatible chat
- Responsive React UI for core workflows

Not yet fully implemented from the challenge brief:
- Change password screen in UI (API exists)
- HR login creation/deactivation/reset UI; Admin must create HR users (endpoint still needed)
- CSV import dry-run and CSV export
- Attendance correction approval inbox/workflow
- Working-day holiday calendar and holiday-aware leave calculation
- Exact monthly working-day calculation, joiner/leaver proration and payslip PDF generation
- Full metrics formulas, date/department filters, charts, attrition/absence insights
- AI tool-calling with all seven specified tools, AI dashboard summary, smart leave JSON prefill and per-user rate limit
- In-app notification UI and delivery polish
- Camera face detection, GPS accuracy/geofence enforcement
- Automated tests

Test core paths with real data and note any unfinished checklist items in the README before submission.
