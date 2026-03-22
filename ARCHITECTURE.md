# Hospital API — Backend Architecture

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Request Lifecycle](#request-lifecycle)
5. [Authentication & Authorization](#authentication--authorization)
6. [Database Layer](#database-layer)
7. [Module Breakdown](#module-breakdown)
8. [Error Handling](#error-handling)
9. [API Response Contract](#api-response-contract)
10. [Environment Configuration](#environment-configuration)
11. [Security Measures](#security-measures)
12. [Complete Route Map](#complete-route-map)

---

## Overview

Himalaya Hospital API is a **modular monolith** — one Express application split into
independent domain modules (auth, patients, appointments, etc.), each owning its own
routes, controller, schema, and SQL queries. All modules share a single MySQL database
connection pool.

```
Client (Postman / Browser / React)
        │
        ▼
  Express App (port 3000)
        │
  ┌─────▼──────────────────────────────────────────┐
  │  Middleware Stack                              │
  │  helmet → cors → morgan → json → rate limiter  │
  └─────┬──────────────────────────────────────────┘
        │
  ┌─────▼──────────────────────────────────────────┐
  │  Router  /api/*                                │
  │  auth │ patients │ appointments │ admissions   │
  │  clinical │ billing │ inventory                │
  │  doctors  │ departments                        │
  └─────┬──────────────────────────────────────────┘
        │
  ┌─────▼──────────────────────────────────────────┐
  │  Per-Route Middleware                          │
  │  authenticate  →  authorize(permission)        │
  │  Zod schema validation                         │
  └─────┬──────────────────────────────────────────┘
        │
  ┌─────▼──────────────────────────────────────────┐
  │  Controller                                    │
  │  Business logic, calls DB queries              │
  └─────┬──────────────────────────────────────────┘
        │
  ┌─────▼──────────────────────────────────────────┐
  │  DB Layer  (src/db/)                           │
  │  query() │ queryOne() │ callProc()             │
  │  mysql2 connection pool                        │
  └─────┬──────────────────────────────────────────┘
        │
        ▼
  MySQL on Railway (hospital_db)
```

---

## Tech Stack

| Concern | Tool | Why |
|---|---|---|
| Runtime | Node.js | JavaScript on the server |
| Language | TypeScript (strict) | Type safety, better IDE support |
| Framework | Express | Lightweight, flexible routing |
| Database | MySQL (Railway) | Relational, matches DBMS project |
| DB Driver | mysql2 | Fast, Promise-based, no ORM overhead |
| Validation | Zod | Runtime validation + TypeScript type inference |
| Auth | JWT (jsonwebtoken) | Stateless, no session storage needed |
| Password | bcrypt | Industry standard password hashing |
| Security | helmet | HTTP security headers |
| CORS | cors | Cross-origin request control |
| Logging | morgan | HTTP request logging |
| Rate limiting | express-rate-limit | Prevents abuse |
| Dev server | ts-node-dev | Hot reload during development |

---

## Project Structure

```
hospital-api/
├── .env                          Environment variables (never commit)
├── .gitignore
├── package.json
├── tsconfig.json
├── README.md
├── ARCHITECTURE.md
│
└── src/
    │
    ├── server.ts                 Entry point — DB ping → listen → graceful shutdown
    ├── app.ts                    Express setup — middleware, routes, 404, error handler
    │
    ├── config/
    │   └── env.ts                Zod-validated env vars (crashes early if .env is wrong)
    │
    ├── db/
    │   ├── pool.ts               mysql2 pool + typed helpers: query, queryOne, callProc
    │   └── queries/              All SQL in one place — one file per domain
    │       ├── auth.queries.ts
    │       ├── patients.queries.ts
    │       ├── appointments.queries.ts
    │       ├── admissions.queries.ts
    │       ├── clinical.queries.ts
    │       ├── billing.queries.ts
    │       ├── inventory.queries.ts
    │       └── doctors.queries.ts     (also contains department queries)
    │
    ├── middleware/
    │   ├── authenticate.ts       Verifies JWT → attaches req.user
    │   ├── authorize.ts          RBAC permission check (role → permission lookup)
    │   └── errorHandler.ts       Global error handler + AppError class
    │
    ├── modules/                  One folder per domain module
    │   ├── auth/
    │   │   ├── auth.schema.ts    Zod input schemas
    │   │   ├── auth.controller.ts
    │   │   └── auth.routes.ts
    │   ├── patients/
    │   │   ├── patients.schema.ts
    │   │   ├── patients.controller.ts
    │   │   └── patients.routes.ts
    │   ├── appointments/         (same 3-file pattern)
    │   ├── admissions/
    │   ├── clinical/
    │   ├── billing/
    │   ├── inventory/
    │   ├── doctors/              (routes + controller combined — small module)
    │   └── departments/          (routes + controller combined — small module)
    │
    ├── routes/
    │   └── index.ts              Mounts all module routers under /api
    │
    ├── types/
    │   ├── db.types.ts           TypeScript interfaces for every DB table row
    │   ├── index.ts              Shared types: JwtPayload, ApiResponse, PaginationParams
    │   └── express.d.ts          Augments Express Request to include req.user
    │
    └── scripts/
        └── hash-password.ts      Utility: generates real bcrypt hash for seed users
```

---

## Request Lifecycle

Every request goes through these layers in order:

```
1. GLOBAL MIDDLEWARE
   helmet()           → sets security headers (XSS, clickjacking protection)
   cors()             → allows/blocks cross-origin requests
   morgan()           → logs method, path, status, response time
   express.json()     → parses JSON body (max 10kb)
   rateLimit()        → max 200 requests per 15 minutes per IP

2. ROUTER
   /api/auth/*        → authRouter
   /api/patients/*    → patientsRouter
   /api/appointments/*→ appointmentsRouter
   ... etc

3. PER-ROUTE MIDDLEWARE (in order)
   authenticate       → reads Authorization header
                      → verifies JWT signature using JWT_SECRET
                      → decodes payload → attaches to req.user
                      → 401 if missing or invalid

   authorize('perm')  → reads req.user.role_id
                      → checks role_permissions table in DB
                      → result is cached in memory per role
                      → 403 if role does not have the permission

4. CONTROLLER
   → Zod schema.parse(req.body / req.query / req.params)
   → 400 if validation fails
   → calls one or more query functions from db/queries/
   → builds response object
   → res.json({ success: true, data: ... })

5. DB LAYER
   query<T>()         → pool.execute(sql, params) → returns T[]
   queryOne<T>()      → same but returns T | undefined
   callProc<T>()      → gets connection → CALL sp_... → SELECT @out_params

6. ERROR HANDLER (catches anything thrown above)
   ZodError           → 400 with field-level error messages
   AppError           → uses the statusCode set when thrown
   ER_DUP_ENTRY       → 409 conflict
   everything else    → 500 (detail hidden in production)
```

---

## Authentication & Authorization

### How JWT works in this project

```
LOGIN                              SUBSEQUENT REQUESTS
──────                             ───────────────────
POST /api/auth/login               GET /api/patients
  ↓                                  ↓
bcrypt.compare(password, hash)     authenticate middleware
  ↓                                  ↓
jwt.sign({                         jwt.verify(token, JWT_SECRET)
  user_id,                           ↓
  email,                           decoded → req.user = {
  role_id,                           user_id, email,
  role_name                          role_id, role_name
}, JWT_SECRET, { expiresIn: '8h' })  }
  ↓
return token to client
```

The token is **stateless** — the server stores nothing. Every request carries
all the identity information needed inside the token itself.

### RBAC (Role-Based Access Control)

There are 6 roles in the system. Each role has a set of permissions stored in
the `role_permissions` table in MySQL.

```
roles table                    permissions table
──────────────                 ─────────────────────────
admin                          users.manage
doctor                         records.view
nurse                          records.edit
receptionist                   appointments.manage
pharmacist                     billing.create
lab_technician                 billing.payment
                               pharmacy.manage
                               lab.manage
                               admissions.manage
                               reports.view
```

**Permission matrix:**

| Permission | admin | doctor | nurse | receptionist | pharmacist | lab tech |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| users.manage | ✓ | | | | | |
| records.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| records.edit | ✓ | ✓ | ✓ | | | |
| appointments.manage | ✓ | ✓ | | ✓ | | |
| billing.create | ✓ | | | ✓ | | |
| billing.payment | ✓ | | | ✓ | | |
| pharmacy.manage | ✓ | | | | ✓ | |
| lab.manage | ✓ | | | | | ✓ |
| admissions.manage | ✓ | | | ✓ | | |
| reports.view | ✓ | | | | | |

**How authorize() works:**

```typescript
// On first request for role_id = 4 (receptionist):
// → queries role_permissions JOIN permissions WHERE role_id = 4
// → builds Set { 'records.view', 'appointments.manage', ... }
// → caches in memory: Map { 4 → Set {...} }

// On every subsequent request for role_id = 4:
// → reads directly from in-memory cache (no DB query)
// → checks if permission is in the Set
```

---

## Database Layer

### Connection Pool

```typescript
// src/db/pool.ts
mysql.createPool({
  connectionLimit: 10,      // max 10 simultaneous connections
  waitForConnections: true, // queue requests when pool is full
  timezone: '+00:00',       // store timestamps in UTC
})
```

### Three query helpers

```typescript
// 1. query<T> — returns array of rows
const patients = await query<PatientRow>(
  'SELECT * FROM patients WHERE phone = ?',
  [phone]
);
// returns PatientRow[]

// 2. queryOne<T> — returns first row or undefined
const patient = await queryOne<PatientRow>(
  'SELECT * FROM patients WHERE patient_id = ?',
  [id]
);
// returns PatientRow | undefined

// 3. callProc<T> — for stored procedures with OUT params
const result = await callProc<SpBookAppointmentResult>(
  'CALL sp_book_appointment(?, ?, ?, ?, ?, @appt_id, @msg)',
  [patientId, doctorId, date, time, reason],
  'SELECT @appt_id AS appointment_id, @msg AS message'
);
// returns SpBookAppointmentResult
```

### Why pure SQL (no ORM)?

This project deliberately avoids ORMs (Prisma, TypeORM, Sequelize) because:

- The database already has stored procedures, triggers, and views built in
- An ORM would fight against or ignore these DB-level features
- Pure SQL gives full control and teaches actual DBMS concepts
- The `db/queries/` pattern keeps SQL organised without needing an ORM
- mysql2 with TypeScript generics gives type safety without abstraction overhead

### Stored Procedures used

| Procedure | Called from | What it does |
|---|---|---|
| sp_book_appointment | appointments controller | Books slot, checks conflicts |
| sp_admit_patient | admissions controller | Admits or waitlists patient |
| sp_transfer_patient | admissions controller | Moves patient between beds |
| sp_discharge_and_bill | admissions controller | Discharges + generates full bill |
| sp_generate_bill | billing controller | Generates outpatient bill |
| sp_record_payment | billing controller | Records payment, updates status |
| sp_monthly_revenue | billing controller | Revenue summary for a month |

### Database Views used

| View | Used in |
|---|---|
| vw_todays_appointments | GET /api/appointments/today |
| vw_bed_occupancy | GET /api/admissions/bed-occupancy |
| vw_available_beds | GET /api/admissions/available-beds |
| vw_waiting_list | GET /api/admissions/waiting-list |
| vw_outstanding_bills | GET /api/billing/outstanding |
| vw_doctor_revenue | GET /api/billing/revenue/doctor |
| vw_low_stock | GET /api/inventory/stock/low |

---

## Module Breakdown

Each module follows the same pattern:

```
module/
├── module.schema.ts      Zod schemas — defines and validates input shape
├── module.controller.ts  Business logic — parses input, calls DB, builds response
└── module.routes.ts      Express router — maps HTTP verbs + paths to controllers
```

The SQL for each module lives separately in `db/queries/module.queries.ts`.
Controllers never write SQL directly — they always call a named query function.

### Module responsibilities

| Module | Responsibility |
|---|---|
| auth | Login, JWT issuance, password change, /me profile |
| patients | Patient CRUD, search, summary, history |
| appointments | Booking, scheduling, slot availability, status updates |
| admissions | Admit/discharge/transfer, bed management, waiting list |
| clinical | Medical records, prescriptions, lab test ordering and results |
| billing | Bill generation, payments, revenue reports |
| inventory | Medicine catalogue, stock levels, low-stock alerts |
| doctors | Doctor listing, individual profiles, schedules |
| departments | Department listing with head doctor info |

---

## Error Handling

All errors are caught by the global `errorHandler` middleware in `src/middleware/errorHandler.ts`.

### AppError — throw this anywhere in a controller

```typescript
throw new AppError('Patient not found', 404);
throw new AppError('Bed is not available', 409);
throw new AppError('Forbidden', 403);
```

### Error type mapping

```
ZodError         → 400  { success: false, message: "Validation error", errors: [...] }
AppError         → uses statusCode set at throw site
ER_DUP_ENTRY     → 409  { success: false, message: "Record already exists" }
anything else    → 500  { success: false, message: "Internal server error" }
                         + detail field in development mode only
```

### Validation errors include field-level detail

```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    "date: Use YYYY-MM-DD",
    "patient_id: Expected number, received string"
  ]
}
```

---

## API Response Contract

Every endpoint returns the same shape. Frontend can always rely on this.

### Success

```json
{
  "success": true,
  "data": { },
  "message": "Optional human-readable message"
}
```

### Success with pagination

```json
{
  "success": true,
  "data": [ ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "pages": 5
  }
}
```

### Error

```json
{
  "success": false,
  "message": "What went wrong",
  "errors": ["field: specific issue"]
}
```

### HTTP status codes used

| Code | When |
|---|---|
| 200 | Successful GET or PATCH |
| 201 | Successful POST that created a resource |
| 400 | Validation error or business rule violation |
| 401 | Missing token, invalid token, wrong password |
| 403 | Valid token but role lacks the required permission |
| 404 | Resource does not exist |
| 409 | Conflict — duplicate phone, slot already booked, bed occupied |
| 500 | Unexpected server error |

---

## Environment Configuration

All environment variables are validated by Zod at startup in `src/config/env.ts`.
If any required variable is missing or wrong, the server exits immediately with a
clear error message rather than crashing later with a cryptic error.

```
Variable              Purpose                          Default
────────────────────  ───────────────────────────────  ────────
NODE_ENV              development / production / test   development
PORT                  HTTP port                         3000
DB_HOST               MySQL host (Railway public host)  required
DB_PORT               MySQL port                        3306
DB_USER               MySQL username                    required
DB_PASSWORD           MySQL password                    required
DB_NAME               Database name                     required
DB_CONNECTION_LIMIT   Pool size                         10
JWT_SECRET            Signing secret (min 32 chars)     required
JWT_EXPIRES_IN        Token lifetime                    8h
BCRYPT_ROUNDS         Password hashing cost             12
```

---

## Security Measures

| Measure | Implementation |
|---|---|
| Password hashing | bcrypt with 12 rounds — never stores plain text |
| Token security | JWT signed with HS256, expires in 8h |
| Input validation | Zod on every request body, query param, and route param |
| SQL injection | mysql2 parameterised queries — no string interpolation |
| Security headers | helmet sets X-Frame-Options, CSP, HSTS etc. |
| Rate limiting | 200 requests / 15 min per IP globally |
| Body size limit | express.json limit: 10kb — blocks payload attacks |
| CORS | Wildcard in dev, restricted in production |
| Error detail | Stack traces and DB errors hidden in production |
| Safe updates | All UPDATE/DELETE queries use parameterised WHERE clauses |

---

## Complete Route Map

```
BASE URL: http://localhost:3000

PUBLIC
──────
GET    /health

AUTH (public)
─────────────
POST   /api/auth/login

AUTH (protected)
────────────────
GET    /api/auth/me                              records.view
PATCH  /api/auth/change-password                 (own account)

PATIENTS
────────
GET    /api/patients                             records.view
GET    /api/patients/:id                         records.view
POST   /api/patients                             admissions.manage
PATCH  /api/patients/:id                         records.edit
GET    /api/patients/:id/summary                 records.view
GET    /api/patients/:id/appointments            records.view
GET    /api/patients/:id/admissions              records.view

APPOINTMENTS
────────────
GET    /api/appointments/today                   appointments.manage
GET    /api/appointments/upcoming                appointments.manage
GET    /api/appointments/by-date                 appointments.manage
GET    /api/appointments/slots                   appointments.manage
GET    /api/appointments/:id                     appointments.manage
POST   /api/appointments                         appointments.manage
PATCH  /api/appointments/:id/status              appointments.manage

ADMISSIONS
──────────
GET    /api/admissions                           admissions.manage
GET    /api/admissions/active                    admissions.manage
GET    /api/admissions/bed-occupancy             admissions.manage
GET    /api/admissions/available-beds            admissions.manage
GET    /api/admissions/waiting-list              admissions.manage
GET    /api/admissions/overdue                   admissions.manage
GET    /api/admissions/:id                       admissions.manage
POST   /api/admissions                           admissions.manage
POST   /api/admissions/waiting-list              admissions.manage
POST   /api/admissions/:id/transfer              admissions.manage
POST   /api/admissions/:id/discharge             admissions.manage

CLINICAL
────────
GET    /api/clinical/records                     records.view
GET    /api/clinical/records/:id                 records.view
POST   /api/clinical/records                     records.edit
GET    /api/clinical/prescriptions               records.view
GET    /api/clinical/prescriptions/:id           records.view
POST   /api/clinical/prescriptions               records.edit
GET    /api/clinical/lab-tests                   records.view
GET    /api/clinical/lab-results                 records.view
GET    /api/clinical/lab-results/pending         lab.manage
POST   /api/clinical/lab-results                 lab.manage
PATCH  /api/clinical/lab-results/:id             lab.manage

BILLING
───────
GET    /api/billing/bills                        billing.create
GET    /api/billing/bills/:id                    billing.create
POST   /api/billing/bills                        billing.create
POST   /api/billing/bills/:id/payment            billing.payment
GET    /api/billing/outstanding                  billing.create
GET    /api/billing/revenue/doctor               reports.view
GET    /api/billing/revenue/monthly              reports.view

INVENTORY
─────────
GET    /api/inventory/medicines                  records.view
GET    /api/inventory/medicines/:id              records.view
GET    /api/inventory/stock                      pharmacy.manage
GET    /api/inventory/stock/low                  pharmacy.manage
PATCH  /api/inventory/stock/:id                  pharmacy.manage

DOCTORS
───────
GET    /api/doctors                              records.view
GET    /api/doctors/:id                          records.view
GET    /api/doctors/:id/schedule                 appointments.manage

DEPARTMENTS
───────────
GET    /api/departments                          records.view
GET    /api/departments/:id                      records.view

─────────────────────────────────────────────────
TOTAL: 50 endpoints across 9 modules
─────────────────────────────────────────────────
```
