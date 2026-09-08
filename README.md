# 🛠️ ProService - Complete Customer Services & Real-Time Support Platform

A modern, full-stack, enterprise-grade customer services platform and real-time support engine built with **Node.js, Express, Socket.IO, JWT, and Tailwind CSS**.

Tailored for 4 core emergency & maintenance services:
1. **📹 Camera Installation (CCTV & IP Cameras)**
2. **💻 Computer & Laptop Repair (Hardware & Software)**
3. **⚡ Electricity Problems & 24/7 Emergency Wiring**
4. **🖨️ Printer Problems & Toner Maintenance**
5. **💬 Real-Time Interactive AI Chatbot (Urdu/English) + Live Support Agent Desk**

---

## 🏛️ Backend Architecture (MVC + Service Layer)

The backend has been completely architected into a modular, production-ready system:

```
service/
├── .env                        # Environment configuration (PORT, JWT_SECRET, ADMIN_CREDENTIALS)
├── .env.example                # Template environment file
├── server.js                   # Lightweight application bootstrap
├── package.json                # Dependencies (express, socket.io, jsonwebtoken, bcryptjs, cors, dotenv)
├── data/
│   └── db.json                 # Persistent thread-safe JSON database with atomic writes
├── src/
│   ├── config/
│   │   ├── constants.js        # Default services, technicians seed data, statuses, roles
│   │   └── db.js               # Thread-safe repository layer with atomic file writes & auto-seeding
│   ├── middlewares/
│   │   ├── authMiddleware.js   # JWT authentication & admin authorization
│   │   ├── validation.js       # Input validation for tickets, auth, technicians, reviews
│   │   ├── logger.js           # HTTP request logging middleware
│   │   └── errorHandler.js     # Centralized standardized JSON error responses
│   ├── services/
│   │   ├── chatbotService.js   # Intelligent bilingual NLP & intent matching engine
│   │   ├── socketService.js    # WebSockets manager for real-time customer/admin events
│   │   └── ticketService.js    # Ticket lifecycle, auto-technician assignment & analytics
│   ├── controllers/
│   │   ├── authController.js   # Admin login, JWT generation, password management
│   │   ├── ticketController.js # Complete ticket CRUD, status updates, search & filters
│   │   ├── technicianController.js # Technician profiles, specialties, availability & workload
│   │   ├── serviceController.js    # Dynamic service catalog & pricing
│   │   ├── chatController.js   # Chat history & session management
│   │   ├── analyticsController.js  # Dashboard KPIs, revenue estimation, workload stats
│   │   ├── reviewController.js # Customer reviews & star ratings
│   │   └── inquiryController.js# Customer contact inquiries inbox
│   └── routes/
│       ├── authRoutes.js       # /api/auth
│       ├── ticketRoutes.js     # /api/tickets
│       ├── technicianRoutes.js # /api/technicians
│       ├── serviceRoutes.js    # /api/services
│       ├── reviewRoutes.js     # /api/reviews
│       ├── inquiryRoutes.js    # /api/inquiries
│       ├── adminRoutes.js      # /api/admin
│       └── index.js            # Combined API router mounted at /api
└── public/
    ├── index.html              # Main customer portal UI
    ├── admin.html              # Admin & Support Agent dashboard (with JWT auth & Tech Select)
    ├── css/style.css           # Styling & animations
    └── js/
        ├── app.js              # Booking modals, ticket tracking logic
        ├── chatbot.js          # Socket.IO real-time chatbot & audio chime
        └── admin.js            # Admin live chat responder, ticket assignment & JWT session
```

---

## 🔐 Default Admin Credentials

When the backend starts, default administrator credentials are automatically initialized:

- **Admin Email**: `admin@proservice.com`
- **Admin Password**: `admin123`
- **Dashboard URL**: [http://localhost:3000/admin](http://localhost:3000/admin)
- *A "Quick 1-Click Demo Login" button is also provided on the admin portal for instant access.*

---

## 📡 Complete REST API Reference

All API routes return a standardized JSON response envelope `{ success: true, ... }`.

### 1. Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/login` | Log in with email & password, returns JWT token | None |
| `GET` | `/api/auth/me` | Get currently logged in user profile | Bearer Token |
| `POST` | `/api/auth/change-password` | Update current user's password | Bearer Token |

### 2. Service Tickets (`/api/tickets`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/tickets` | Book a new service ticket (validates fields, auto-assigns specialist) | None |
| `GET` | `/api/tickets/:id` | Track ticket status by unique ID (e.g. `TKT-82910`) | None |

### 3. Technicians Management (`/api/technicians`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/technicians` | List all technicians (filters: `?specialty=camera&status=available`) | None / Optional |
| `GET` | `/api/technicians/:id` | Get technician profile & active jobs | None |
| `POST` | `/api/technicians` | Register new technician | Admin |
| `PATCH` | `/api/technicians/:id` | Update technician status, specialty, or rating | Admin |
| `DELETE` | `/api/technicians/:id` | Remove technician | Admin |

### 4. Services Catalog (`/api/services`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/services` | Get all active services, features, and pricing | None |
| `GET` | `/api/services/:id` | Get details of a single service | None |
| `POST` | `/api/services` | Add new service package | Admin |
| `PATCH` | `/api/services/:id` | Update service pricing or turnaround time | Admin |

### 5. Admin Console Endpoints (`/api/admin`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/admin/tickets` | Get all tickets with filtering, search & pagination | Optional / Admin |
| `PATCH` | `/api/admin/tickets/:id` | Update ticket status, assign technician, add notes | Optional / Admin |
| `DELETE` | `/api/admin/tickets/:id` | Delete ticket | Admin |
| `GET` | `/api/admin/chats` | List all active chat sessions sorted by recent update | Optional / Admin |
| `GET` | `/api/admin/chats/:sessionId` | Get specific conversation transcript | Optional / Admin |
| `DELETE` | `/api/admin/chats/:sessionId` | Delete chat session | Admin |
| `GET` | `/api/admin/analytics` | Complete dashboard KPIs, revenue stats & workload | Optional / Admin |
| `GET` | `/api/admin/inquiries` | View all customer contact inquiries | Optional / Admin |
| `PATCH` | `/api/admin/inquiries/:id` | Mark inquiry status (read/replied) | Optional / Admin |

### 6. Customer Reviews & Contact Inquiries
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/reviews` | Get customer feedback and testimonials | None |
| `POST` | `/api/reviews` | Submit star rating (1-5) and review for a ticket | None |
| `POST` | `/api/inquiries` | Submit contact us / corporate inquiry form | None |

### 7. Health Check
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Server status, uptime, and timestamp |

---

## ⚡ WebSockets Real-Time Communication (`Socket.IO`)

The backend coordinates dual-channel real-time events between visitors and support agents:

- **Customer Events**:
  - `customer_join`: Join room with `sessionId`. Emits `chat_history`.
  - `customer_message`: Customer sends message. Triggers bilingual bot reply or forwards to Live Agent room.
  - `customer_typing`: Broadcasts typing indicator to admin desk.
  - `agent_handoff`: Auto-triggers when customer asks for a human agent.
- **Admin Events**:
  - `admin_join`: Joins `admins` room. Emits `admin_all_chats`.
  - `admin_message`: Live agent sends instant reply to customer.
  - `admin_toggle_mode`: Admin toggles session between Bot and Live mode.
  - `new_ticket`: Real-time toast alert & audio chime when a customer books a service.
  - `ticket_updated`: Real-time sync across all open browser tabs when status changes.

---

## 🚀 How to Run the Website

1. Install dependencies (if not already installed):
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   node server.js
   ```

3. Open in your browser:
   - **Customer Portal**: [http://localhost:3000](http://localhost:3000)
   - **Admin / Staff Console**: [http://localhost:3000/admin](http://localhost:3000/admin)
   - **API Health**: [http://localhost:3000/api/health](http://localhost:3000/api/health)
