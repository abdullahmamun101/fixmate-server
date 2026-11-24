FixMate Server — REST API

The FixMate Server is the backend REST API for the FixMate repair service booking platform. It handles authentication verification, role-based authorization, service management, repair bookings, admin operations, and Stripe payment processing.

Live API

Backend: https://fixmate-server-4if8.onrender.com

Frontend: https://fixmate-client-sepia.vercel.app

Server Repository: https://github.com/abdullahmamun101/fixmate-server

Client Repository: https://github.com/abdullahmamun101/fixmate-client

Key Features

RESTful API built with Express.js.

MongoDB Atlas database integration.

JWT token verification middleware.

Role-based authorization for Customers, Technicians, and Admins.

Service creation, updating, deletion, and approval management.

Customer repair booking and cancellation.

Technician booking management and job status updates.

Admin user, service, booking, and payment management.

Stripe Checkout session creation.

Stripe webhook verification and payment status updates.

Duplicate payment prevention.

Protected API routes and ownership validation.

CORS configuration for production and local development.

Environment-based configuration for sensitive credentials.

Technology Stack

Node.js

Express.js

MongoDB

JWT

Stripe

CORS

dotenv

Database Collections

The application uses these main collections:

users — User accounts, roles, and profile information.

services — Technician repair service listings.

bookings — Customer repair requests and job status.

payments — Verified payment records.