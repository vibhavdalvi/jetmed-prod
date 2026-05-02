# 💊 JetMed - Pharmacy Delivery Platform

> **Production-Ready Full-Stack Application** with 6 Stakeholder Dashboards

<p align="center">
  <img src="https://img.shields.io/badge/React-18.2-blue?logo=react" />
  <img src="https://img.shields.io/badge/Node.js-20+-green?logo=node.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript" />
  <img src="https://img.shields.io/badge/MongoDB-6+-green?logo=mongodb" />
</p>

---

## 📋 Table of Contents

1. [Overview](#-overview)
2. [Features](#-features)  
3. [Quick Start](#-quick-start)
4. [API Integrations](#-api-integrations)
5. [Environment Setup](#-environment-setup)
6. [User Flows](#-user-flows)
7. [Demo Credentials](#-demo-credentials)

---

## 🎯 Overview

JetMed is a **complete pharmacy delivery platform** built based on 38 comprehensive requirements. It enables customers to order prescription and OTC medicines with pharmacist verification, real-time tracking, and fast delivery.

### Value Proposition
> "Get your prescription medication delivered within 1 hour, even at 11 PM."

---

## ✨ Features

### 6 Stakeholder Dashboards

| Dashboard | Role | Key Features |
|-----------|------|--------------|
| **Customer** | End User | Browse medicines, checkout, track orders, wallet |
| **Pharmacist** | Reviewer | Review prescriptions, approve/reject, VoIP calls |
| **Sr. Pharmacist** | Escalation | Handle escalations, override decisions |
| **Delivery Partner** | Driver | Accept orders, GPS navigation, OTP delivery |
| **Warehouse** | Packer | Manage inventory, pack orders, catalog |
| **Admin** | Manager | User management, analytics, settings |

### Core Features (Per 38 Questions)

- **🛒 7-Step Checkout** - Cart → Address → Delivery Speed → Prescription → Symptoms → Payment → Confirm
- **📱 Multi-Auth** - Email + Phone OTP + Google + Apple (Q8)
- **💳 Stripe Payments** - Payment before review, refund if rejected (Q9)
- **🗺️ Google Maps** - Address autocomplete, delivery tracking (Q6)
- **📞 Agora VoIP** - Anonymous pharmacist-patient calls (Q15)
- **📲 Notifications** - Push + SMS + WhatsApp + Email (Q13)
- **⏰ Session Management** - 30-min timeout, multiple devices (Q8)
- **🔒 2FA** - Optional for customers, required for staff (Q8)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 6+ (local `mongod` or Atlas URI via `MONGODB_URI`)

### 1. Install Dependencies

```bash
cd jetmed
npm run install:all
```

### 2. Configure Environment

```bash
# Copy template
cp backend/.env.production backend/.env

# Edit .env with your API keys
# See "API Integrations" section below
```

### 3. Setup Database

```bash
# Ensure MongoDB is running and MONGODB_URI is set (defaults to mongodb://127.0.0.1:27017/jetmed)
npm run seed
```

### 4. Start Servers

```bash
npm run dev
```

- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:5000
- **API Docs:** http://localhost:5000/api-docs

---

## 🔌 API Integrations

All services have complete implementations in `/backend/src/services/`:

### Stripe (Payments)
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```
**File:** `services/stripe.ts` - Payment intents, refunds, wallet top-ups

### Google Maps
```env
GOOGLE_MAPS_API_KEY=AIza...
```
**File:** `services/maps.ts` - Address autocomplete, geocoding, distance, routing

### Agora (VoIP/Video)
```env
AGORA_APP_ID=...
AGORA_APP_CERTIFICATE=...
```
**File:** `services/agora.ts` - Voice/video calls, screen share, recording

### Twilio (SMS/WhatsApp)
```env
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
```
**File:** `services/twilio.ts` - OTP, order updates, delivery notifications

### SendGrid (Email)
```env
SENDGRID_API_KEY=SG...
```
**File:** `services/email.ts` - Welcome, orders, prescriptions, invoices

### Firebase (Push)
```env
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="..."
```
**File:** `services/push.ts` - Order status, alerts, topics

---

## ⚙️ Environment Setup

Copy `backend/.env.production` to `backend/.env` and configure:

| Category | Key Variables |
|----------|---------------|
| **App** | PORT, NODE_ENV, FRONTEND_URL |
| **Auth** | JWT_SECRET, JWT_REFRESH_SECRET, SESSION_TIMEOUT_MINUTES=30 |
| **Database** | **MONGODB_URI** (required — MongoDB Atlas or local `mongodb://127.0.0.1:27017/jetmed`) |
| **Stripe** | STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY |
| **Maps** | GOOGLE_MAPS_API_KEY |
| **Agora** | AGORA_APP_ID, AGORA_APP_CERTIFICATE |
| **Twilio** | TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN |
| **SendGrid** | SENDGRID_API_KEY |
| **Firebase** | FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY |
| **Business** | DELIVERY_FEE_STANDARD=2.99, DELIVERY_FEE_EXPRESS=5.99 |

---

## 🔄 User Flows

### Customer Checkout (7 Steps)

```
Browse Medicines → Add to Cart → Login Gate 🔒
    ↓
Step 1: Review Cart
Step 2: Select Address (Google Autocomplete)
Step 3: Delivery Speed (Standard/Express/Emergency/Scheduled)
Step 4: Upload Prescription (if Rx items - else skip)
Step 5: Describe Symptoms (if Rx items - else skip)
Step 6: Payment (Stripe)
Step 7: Review & Confirm → Order Placed ✅
```

### Order Status Flow

```
placed → pending_review → approved → packing → packed 
    → assigned_to_delivery → out_for_delivery → delivered
                              (Live GPS)         (OTP)
```

### Pharmacist Review Flow

```
View Queue → Select Order → See Anonymous Patient Details
    → Review Prescription & Symptoms
    → Actions: Approve | Reject | Request Info | Modify | Escalate
    → VoIP Call Option (Anonymous)
```

---

## 👥 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Customer | john.doe@example.com | Customer@123 |
| Admin | admin@jetmed.com | Admin@123 |
| Pharmacist | pharmacist1@jetmed.com | Pharma@123 |
| Sr. Pharmacist | senior.pharmacist@jetmed.com | Senior@123 |
| Delivery | driver1@jetmed.com | Driver@123 |
| Warehouse | warehouse1@jetmed.com | Warehouse@123 |

---

## 📁 Project Structure

```
jetmed/
├── backend/
│   ├── src/
│   │   ├── services/        # All API integrations
│   │   │   ├── stripe.ts    # Payments
│   │   │   ├── maps.ts      # Google Maps
│   │   │   ├── agora.ts     # VoIP/Video
│   │   │   ├── twilio.ts    # SMS/WhatsApp
│   │   │   ├── email.ts     # SendGrid
│   │   │   ├── push.ts      # Firebase
│   │   │   └── socket.ts    # Real-time
│   │   ├── models/          # 19 database models
│   │   ├── routes/          # API endpoints
│   │   └── seeds/           # Demo data
│   └── .env.production      # Full config template
│
├── frontend/
│   └── src/
│       └── pages/
│           ├── customer/    # Dashboard 1
│           ├── pharmacist/  # Dashboard 2 & 3
│           ├── delivery/    # Dashboard 4
│           ├── warehouse/   # Dashboard 5
│           └── admin/       # Dashboard 6
│
└── README.md
```

---

## 📄 Based on 38 Questions Requirements

This implementation covers all requirements from the 38 questions Q&A:

- **Q1-3:** Core user flow, account fields, medicine catalog
- **Q6:** Delivery system with 4 speeds and hybrid fleet
- **Q7:** 6 stakeholder dashboards
- **Q8:** Authentication with multi-method login, 2FA, 30-min sessions
- **Q9:** Payment with Stripe, wallet, refund scenarios
- **Q13:** All notification channels (push, SMS, WhatsApp, email)
- **Q15:** Anonymous VoIP/video communication
- **Q20:** 7-step checkout with conditional steps
- **Q21-25:** Order management, tracking, edge cases
- **Q26-27:** Legal compliance, HIPAA considerations
- **And more...**

---

<p align="center">
  Built with ❤️ | Production Ready
</p>
