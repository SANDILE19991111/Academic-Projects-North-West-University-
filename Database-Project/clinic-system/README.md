# 🏥 ClinicCare — Clinic Appointment System
**CMPG 311 | Group 12 | NWU**

---

## 📁 Project Structure

```
clinic-system/
├── frontend/
│   ├── index.html          ← Main UI (open in browser)
│   ├── css/
│   │   └── style.css       ← Stylesheet
│   └── js/
│       └── app.js          ← Frontend logic & API calls
│
├── backend/
│   ├── server.js           ← Express server entry point
│   ├── package.json        ← Node.js dependencies
│   ├── .env.example        ← Copy to .env and configure
│   ├── config/
│   │   └── db.js           ← PostgreSQL connection pool
│   ├── middleware/
│   │   └── auth.js         ← JWT auth + RBAC
│   └── routes/
│       ├── auth.js         ← Login / register
│       ├── patients.js     ← Patient CRUD
│       ├── appointments.js ← Appointment booking
│       ├── doctors.js      ← Doctor management
│       ├── records.js      ← Medical records + prescriptions
│       ├── inventory.js    ← Pharmacy & stock
│       ├── billing.js      ← Invoices & payments
│       └── waitlist.js     ← Waitlist management
│
└── database/
    └── schema.sql          ← Full PostgreSQL schema + seed data
```

---

## 🚀 Setup Instructions

### 1. Set Up the Database

1. Install [PostgreSQL](https://www.postgresql.org/download/)
2. Open pgAdmin or psql terminal
3. Create the database:
   ```sql
   CREATE DATABASE clinic_db;
   ```
4. Run the schema:
   ```bash
   psql -U postgres -d clinic_db -f database/schema.sql
   ```

---

### 2. Set Up the Backend

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` from the template:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` with your database credentials:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=clinic_db
   DB_USER=postgres
   DB_PASSWORD=your_actual_password
   JWT_SECRET=any_long_random_string_here
   ```

5. Start the server:
   ```bash
   npm start
   # or for hot-reload during development:
   npm run dev
   ```

   You should see:
   ```
   ✅ Connected to PostgreSQL database
   🏥 ClinicCare API running on http://localhost:3000
   ```

---

### 3. Set Up the Frontend

**Option A — VS Code Live Server (Recommended)**
1. Install the "Live Server" extension in VS Code
2. Right-click `frontend/index.html` → **Open with Live Server**
3. It opens at `http://localhost:5500`

**Option B — Direct File**
1. Open `frontend/index.html` directly in Chrome/Firefox
2. Note: Some browsers block fetch requests to localhost from file:// — use Live Server instead

---

## 🔐 Login Credentials (Test Accounts)

| Username       | Password     | Role          |
|---------------|-------------|---------------|
| admin.kim      | password123  | Admin         |
| dr.mokoena     | password123  | Doctor        |
| nurse.lee      | password123  | Nurse         |
| recept.zulu    | password123  | Receptionist  |
| pharma.joy     | password123  | Pharmacist    |

> **Demo Mode:** If the backend is not running, the frontend still works with sample data so you can see the UI.

---

## 🌐 API Endpoints

### Auth
| Method | Endpoint           | Description       |
|--------|--------------------|-------------------|
| POST   | /api/auth/login    | Login             |
| POST   | /api/auth/register | Register account  |

### Patients
| Method | Endpoint              | Description         |
|--------|-----------------------|---------------------|
| GET    | /api/patients         | List all patients   |
| GET    | /api/patients/:id     | Get single patient  |
| POST   | /api/patients         | Register patient    |
| PUT    | /api/patients/:id     | Update patient      |
| DELETE | /api/patients/:id     | Delete patient      |

### Appointments
| Method | Endpoint                   | Description          |
|--------|----------------------------|----------------------|
| GET    | /api/appointments          | List appointments    |
| POST   | /api/appointments          | Book appointment     |
| PATCH  | /api/appointments/:id      | Update status        |
| DELETE | /api/appointments/:id      | Cancel appointment   |

### Doctors
| Method | Endpoint                        | Description             |
|--------|---------------------------------|-------------------------|
| GET    | /api/doctors                    | List doctors            |
| POST   | /api/doctors                    | Add doctor              |
| GET    | /api/doctors/:id/availability   | Get availability        |
| POST   | /api/doctors/:id/availability   | Add availability slot   |
| DELETE | /api/doctors/:id                | Deactivate doctor       |

### Medical Records
| Method | Endpoint                          | Description             |
|--------|-----------------------------------|-------------------------|
| GET    | /api/records?patient_id=X         | Get records             |
| POST   | /api/records                      | Create record           |
| POST   | /api/records/:id/prescriptions    | Add prescription        |

### Inventory
| Method | Endpoint                     | Description      |
|--------|------------------------------|------------------|
| GET    | /api/inventory               | List all items   |
| GET    | /api/inventory/alerts        | Low stock alerts |
| POST   | /api/inventory               | Add item         |
| PATCH  | /api/inventory/:id/restock   | Restock item     |
| DELETE | /api/inventory/:id           | Remove item      |

### Billing
| Method | Endpoint              | Description         |
|--------|-----------------------|---------------------|
| GET    | /api/billing          | List invoices       |
| GET    | /api/billing/summary  | Revenue summary     |
| POST   | /api/billing          | Create invoice      |
| PATCH  | /api/billing/:id      | Update status       |
| DELETE | /api/billing/:id      | Delete invoice      |

### Waitlist
| Method | Endpoint            | Description       |
|--------|---------------------|-------------------|
| GET    | /api/waitlist       | List waitlist     |
| POST   | /api/waitlist       | Add to waitlist   |
| PATCH  | /api/waitlist/:id   | Update status     |
| DELETE | /api/waitlist/:id   | Remove entry      |

---

## 🛡️ Security Features

- JWT authentication (24h expiry)
- Role-Based Access Control (RBAC): Admin, Doctor, Nurse, Receptionist, Pharmacist
- Password hashing with bcryptjs (12 rounds)
- Account lockout after 5 failed login attempts
- POPIA compliance-ready data handling

---

## 📋 Technology Stack

| Layer     | Technology            |
|-----------|-----------------------|
| Frontend  | HTML5, CSS3, Vanilla JS |
| Backend   | Node.js + Express.js  |
| Database  | PostgreSQL            |
| Auth      | JWT + bcryptjs        |
| HTTP      | REST API              |
