# Modern Educational Centre — School Website

Public school website plus login portals and an Administration dashboard. Built with plain HTML/CSS/JS on the frontend and a self-contained Node.js backend using a JSON-file store (no database install required).

## Features

- **Public site** — Home, About, Academics, Admissions (with online application + document upload), Day School, Boarding Life, News & Events (fed by the CMS), Gallery, Contact.
- **Student / Parent / Staff portals** — role-based login at `/auth/login`, fee balances and **Pay Now** (Paystack), student admissions status, parent view of children.
- **Administration dashboard** — `/admin`: application review/approval workflow (creates the student record + login automatically), fee CRUD, payments (Paystack + manual), News/Events CMS with publish control, reports with CSV export.
- **Notifications** — email receipts sent on successful payments (SMTP/Gmail).

## Quick start

Requirements: Node.js 18+ (developed on Node 24).

```bash
npm install
node server.js
```

Open `http://127.0.0.1:8000` (server binds all interfaces on port 8000).

The first boot creates `data/db.json` with the seed accounts below. Delete that file to reset to the clean seed.

## Default accounts

| Role | Email | Password | Portal |
| --- | --- | --- | --- |
| Administrator | `admin@mec.edu.gh` | `Admin@123` | `/admin` |
| Student | `student@mec.edu.gh` | `Student@123` | `/auth/login` (Student) |
| Parent | `parent@mec.edu.gh` | `Parent@123` | `/auth/login` (Parent) |
| Staff | `staff@mec.edu.gh` | `Staff@123` | `/auth/login` (Staff) |

When an application is approved, the pupil's login uses their guardian email with password `Student@123`.

Change these passwords before any real deployment.

## Configuration (`config/config.json`)

Copy `config/config.example.json` to `config/config.json` and fill in:

- **Paystack** (online payments): `paystack.publicKey` and `paystack.secretKey` — get them from the Paystack dashboard (use **test** keys until you go live).
- **Email** (receipts & notifications): `gmailUser` (your Gmail address) and `gmailAppPassword` (Google App Password, **not** your normal password — enable 2-Factor Auth first, then create one at myaccount.google.com/apppasswords).

Until keys are provided the features are gracefully disabled: online payments return a clear message, and emails are no-ops.

## Sharing on the same WiFi / LAN

1. Make sure this computer stays on with the server running (`node server.js`).
2. Open port 8000 in Windows Firewall once (as Administrator):

   ```bat
   netsh advfirewall firewall add rule name="MEC Website Server" dir=in action=allow protocol=TCP localport=8000
   ```

3. Find this computer's LAN IP (`ipconfig`) and share `http://<LAN-IP>:8000`.

## Project layout

```
server.js            HTTP server (static files + /api routes)
lib/                 Backend modules (auth, db, api, paystack, email, sms)
config/              Config (real config is git-ignored)
js/                  Client scripts (portals, admin, application form, news feed)
auth/                Login + student/parent/staff dashboards
admin/               Administration dashboard
css js images        Public site assets (pages live in the root)
data/                Runtime JSON store (git-ignored, auto-created)
```

## API

All routes live under `/api` and return JSON. Auth via `Authorization: Bearer <token>` from `POST /api/auth/login`.

- `POST /api/auth/login|logout`, `GET /api/me`, `GET /api/me/fees`
- `POST /api/applications`, `GET /api/applications`, `PATCH /api/applications/:id/status`
- `GET|POST /api/fees`, `DELETE /api/fees/:id`
- `GET /api/payments`, `POST /api/payments/init|manual`, `GET /api/payments/verify`
- `GET|POST|PATCH|DELETE /api/news` and `/api/events`
- `GET /api/reports/overview|collections` (+ `.csv` exports)
- `GET /api/students` (admin), `GET /api/health`

## License

Private project for the Modern Educational Centre.