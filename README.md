# DentFlow - Dental Clinic Management SaaS

A comprehensive, production-ready SaaS platform for dental clinics to manage appointments, patient records, treatments, reminders, and analytics.

![DentFlow](https://img.shields.io/badge/DentFlow-Dental%20Management-blue)
![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql)

## Features

### Core Features

- **Multi-Tenant SaaS Architecture** - Each clinic has isolated data and independent management
- **Clinic Dashboard** - Overview of today's appointments, upcoming bookings, new patients, and revenue
- **Patient Management** - Complete patient database with medical history, allergies, and visit tracking
- **Appointment Management** - Create, reschedule, cancel appointments with intelligent time slot management
- **Services/Treatments** - Manage dental services with pricing, duration, and color coding
- **Public Booking Page** - Custom booking URL for each clinic (e.g., `/book/clinic-id`)
- **Analytics & Reports** - Visual charts for appointments, revenue, and patient statistics

### Advanced Features

- **SMS Reminders** - Automatic appointment reminders via SMS (MSG91/Twilio integration)
- **WhatsApp Reminders** - WhatsApp Cloud API integration for appointment notifications
- **Follow-up Automation** - Automatic Google review requests after appointments
- **Time Slot Logic** - Smart scheduling based on clinic hours and service duration
- **Double Booking Prevention** - Real-time availability checking

## Tech Stack

### Frontend
- React 18+ with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- shadcn/ui components
- React Router for navigation
- Zustand for state management
- Axios for API calls
- Recharts for analytics charts

### Backend
- Node.js with Express
- MySQL database
- JWT authentication
- bcryptjs for password hashing
- node-cron for scheduled tasks
- express-validator for input validation

### External APIs
- MSG91 or Twilio for SMS
- WhatsApp Cloud API for WhatsApp messages

## Project Structure

```
/mnt/okcomputer/output/
├── app/                    # Frontend React Application
│   ├── src/
│   │   ├── components/     # UI Components
│   │   ├── layouts/        # Page Layouts
│   │   ├── pages/          # Application Pages
│   │   ├── services/       # API Services
│   │   ├── store/          # State Management
│   │   └── App.tsx         # Main Application
│   └── package.json
│
├── backend/                # Backend Node.js Application
│   ├── config/             # Database & Configuration
│   ├── controllers/        # Request Handlers
│   ├── middleware/         # Auth & Validation
│   ├── models/             # Database Models
│   ├── routes/             # API Routes
│   ├── services/           # Business Logic
│   ├── utils/              # Utilities
│   └── server.js           # Entry Point
│
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- npm or yarn

### Database Setup

1. Create a MySQL database:
```sql
CREATE DATABASE dentflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. Run the schema file:
```bash
mysql -u root -p dentflow < backend/config/schema.sql
```

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your database and API credentials
```

4. Start the server:
```bash
npm run dev
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd app
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
# Create .env file
echo "VITE_API_URL=http://localhost:5000/api" > .env
```

4. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

## API Documentation

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new clinic |
| POST | `/api/auth/login` | Login clinic |
| GET | `/api/auth/me` | Get current clinic profile |
| PUT | `/api/auth/profile` | Update clinic profile |

### Patient Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/patients` | Get all patients |
| GET | `/api/patients/:id` | Get patient details |
| POST | `/api/patients` | Create new patient |
| PUT | `/api/patients/:id` | Update patient |
| DELETE | `/api/patients/:id` | Delete patient |

### Appointment Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/appointments` | Get all appointments |
| GET | `/api/appointments/today` | Get today's appointments |
| GET | `/api/appointments/available-slots` | Get available time slots |
| POST | `/api/appointments` | Create appointment |
| PUT | `/api/appointments/:id` | Update appointment |
| DELETE | `/api/appointments/:id` | Cancel appointment |

### Service Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/services` | Get all services |
| POST | `/api/services` | Create service |
| PUT | `/api/services/:id` | Update service |
| DELETE | `/api/services/:id` | Delete service |

### Public Endpoints (No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/public/clinic/:id` | Get clinic public info |
| GET | `/api/public/available-slots` | Get available slots |
| POST | `/api/public/book-appointment` | Book appointment |

## Environment Variables

### Backend (.env)

```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=dentflow

# JWT
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=7d

# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# SMS (MSG91)
SMS_PROVIDER=msg91
SMS_API_KEY=your_msg91_api_key
SMS_SENDER_ID=DENTFL

# WhatsApp Cloud API
WHATSAPP_ACCESS_TOKEN=your_whatsapp_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:5000/api
```

## Deployment

### Frontend (Vercel)

1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variable: `VITE_API_URL`
4. Deploy

### Backend (Railway/Render)

1. Push code to GitHub
2. Connect repository to Railway or Render
3. Set all environment variables
4. Deploy

### Database (Railway)

1. Create MySQL database on Railway
2. Connect to your backend service
3. Run migrations

## Multi-Tenant Security

The application implements multi-tenant security through:

1. **JWT Authentication** - Each request includes a valid token
2. **Clinic ID Filtering** - All database queries filter by `clinic_id`
3. **Middleware Validation** - Authentication middleware ensures clinic access
4. **Row-Level Security** - Database queries automatically scope to the authenticated clinic

Example:
```javascript
// All queries include clinic_id filter
const [patients] = await pool.execute(
  'SELECT * FROM patients WHERE clinic_id = ?',
  [req.clinic.clinic_id]
);
```

## Scheduled Jobs

The system runs scheduled jobs using node-cron:

1. **Appointment Reminders** - Runs every hour, sends SMS/WhatsApp 24 hours before appointment
2. **Review Requests** - Runs daily at 9 AM, sends Google review link to completed appointments

## License

This project is licensed under the ISC License.

## Support

For support, email support@dentflow.com or join our Slack channel.

---

Built with by the DentFlow Team
