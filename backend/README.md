# a3houseoffriends Backend API

Complete backend API for the a3houseoffriends queue and booking system.

## Features

- ✅ RESTful API with Express.js
- ✅ MongoDB database with Mongoose ODM
- ✅ JWT authentication
- ✅ Role-based access control (Admin/Staff)
- ✅ Razorpay payment integration
- ✅ Session management
- ✅ Food ordering system
- ✅ Activity and unit management

## Setup

### Prerequisites

- Node.js 18+ 
- MongoDB 6+ (or MongoDB Atlas account)
- Razorpay account (for payments)

### Installation

1. Install dependencies:
```bash
cd backend
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Set up MongoDB:
```bash
# MongoDB creates databases automatically, no need to create manually
# Just ensure MongoDB is running
```

4. Verify connection:
```bash
npm run check-db
```

5. Seed initial data:
```bash
npm run seed
```

### Environment Variables

See `.env.example` for all required variables:

- `MONGODB_URI` - MongoDB connection string (or use DB_HOST, DB_PORT, DB_NAME)
- `JWT_SECRET` - Secret key for JWT tokens
- `RAZORPAY_KEY_ID` - Razorpay API key
- `RAZORPAY_KEY_SECRET` - Razorpay API secret
- `FRONTEND_URL` - Frontend URL for CORS

## Running

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `GET /api/auth/profile` - Get current user profile

### Activities
- `GET /api/activities` - Get all activities
- `GET /api/activities/:id` - Get activity by ID
- `POST /api/activities` - Create activity (Admin)
- `PUT /api/activities/:id` - Update activity (Admin)
- `DELETE /api/activities/:id` - Delete activity (Admin)

### Sessions
- `POST /api/sessions` - Create session
- `GET /api/sessions/:id` - Get session by ID
- `GET /api/sessions` - Get active sessions (Staff/Admin)
- `POST /api/sessions/:id/extend` - Extend session (Staff/Admin)
- `POST /api/sessions/:id/end` - End session (Staff/Admin)

### Orders
- `GET /api/orders/menu` - Get menu items
- `POST /api/orders` - Create order
- `GET /api/orders/:id` - Get order by ID
- `GET /api/orders` - Get all orders (Staff/Admin)
- `PUT /api/orders/:id/status` - Update order status (Staff/Admin)

### Payments
- `POST /api/payments/create-order` - Create Razorpay order
- `POST /api/payments/verify` - Verify payment
- `POST /api/payments/offline` - Mark offline payment (Staff/Admin)
- `POST /api/payments/webhook` - Razorpay webhook

## Database Schema

MongoDB uses collections (similar to tables). See model files in `src/models/` for schemas.

Main collections:
- `users` - Admin and staff users
- `activities` - Activity types and pricing
- `activityunits` - Individual units (tables, stations, etc.)
- `sessions` - Active and past sessions
- `menuitems` - Food menu items
- `foodorders` - Food orders

**Note:** MongoDB creates collections automatically when first document is inserted. No migrations needed!

## Default Credentials

After seeding:
- Username: `admin`
- Password: `admin123`

**Change these immediately in production!**

## Project Structure

```
backend/
├── src/
│   ├── config/         # Configuration files
│   ├── controllers/     # Request handlers
│   ├── database/        # Migrations and seeds
│   ├── lib/             # Utility functions
│   ├── middleware/      # Express middleware
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   └── server.ts        # Main server file
├── .env.example        # Environment template
├── package.json
└── tsconfig.json
```

## Security

- JWT tokens for authentication
- Password hashing with bcrypt
- Input validation with Zod
- SQL injection protection with parameterized queries
- CORS configuration
- Rate limiting (can be added)

## License

ISC

