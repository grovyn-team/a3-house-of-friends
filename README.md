# A3 House of Friends - Monorepo

A comprehensive queue and booking system for managing customer sessions, activities, and food orders. This monorepo contains both the frontend React application and the backend Express API.

## 📁 Project Structure

```
a3-house/
├── frontend/          # React + TypeScript + Vite frontend
├── backend/           # Express + TypeScript + MongoDB backend
├── package.json       # Root package.json with workspace configuration
└── README.md          # This file
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **MongoDB** (v6 or higher) - [Setup Guide](./backend/MONGODB_SETUP.md)
- **Redis** (v7 or higher) - For session management and real-time features
- **npm** (v9 or higher)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd a3-house
   ```

2. **Install all dependencies**
   ```bash
   npm install
   ```
   
   This will install dependencies for both frontend and backend workspaces.

3. **Set up environment variables**

   **Backend** (`backend/.env`):
   ```env
   PORT=3000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173
   MONGODB_URI=mongodb://localhost:27017/a3houseoffriends
   REDIS_URL=redis://localhost:6379
   JWT_SECRET=your_super_secret_jwt_key_change_in_production_12345
   JWT_EXPIRES_IN=7d
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=your_secret_key
   ```

   **Frontend** (`frontend/.env`):
   ```env
   VITE_API_URL=http://localhost:3000/api
   VITE_WS_URL=http://localhost:3000
   ```

4. **Start MongoDB and Redis**
   ```bash
   # macOS
   brew services start mongodb-community
   brew services start redis
   
   # Linux
   sudo systemctl start mongod
   sudo systemctl start redis-server
   ```

5. **Seed the database**
   ```bash
   cd backend
   npm run seed
   ```
   
   Default admin credentials:
   - Username: `admin`
   - Password: `admin123`

6. **Start development servers**

   **Option 1: Start both together**
   ```bash
   npm run dev
   ```

   **Option 2: Start separately**
   ```bash
   # Terminal 1 - Backend
   npm run dev:backend
   
   # Terminal 2 - Frontend
   npm run dev:frontend
   ```

7. **Access the application**
   - Frontend: http://localhost:5173
   - Admin Dashboard: http://localhost:5173/admin/login
   - Backend API: http://localhost:3000/api

## 📜 Available Scripts

### Root Level (Monorepo)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start both frontend and backend in development mode |
| `npm run dev:frontend` | Start only frontend development server |
| `npm run dev:backend` | Start only backend development server |
| `npm run build` | Build both frontend and backend |
| `npm run build:frontend` | Build only frontend |
| `npm run build:backend` | Build only backend |
| `npm run lint` | Run linters for all workspaces |
| `npm install` | Install dependencies for all workspaces |

### Frontend Workspace

See [frontend/README.md](./frontend/QUICK_START.md) for frontend-specific scripts.

| Script | Description |
|--------|-------------|
| `npm run dev --workspace=frontend` | Start Vite dev server |
| `npm run build --workspace=frontend` | Build for production |
| `npm run preview --workspace=frontend` | Preview production build |

### Backend Workspace

See [backend/README.md](./backend/README.md) for backend-specific scripts.

| Script | Description |
|--------|-------------|
| `npm run dev --workspace=backend` | Start backend with hot reload |
| `npm run build --workspace=backend` | Compile TypeScript |
| `npm start --workspace=backend` | Start production server |
| `npm run seed --workspace=backend` | Seed database with initial data |
| `npm run migrate --workspace=backend` | Run database migrations |

## 🏗️ Technology Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **TanStack Query** - Data fetching and caching
- **Socket.io Client** - Real-time updates
- **Radix UI** - Accessible component primitives
- **Tailwind CSS** - Styling
- **Zod** - Schema validation
- **React Hook Form** - Form management

### Backend
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **MongoDB + Mongoose** - Database and ODM
- **Redis + ioredis** - Caching and session storage
- **Socket.io** - WebSocket server
- **JWT** - Authentication
- **Razorpay** - Payment gateway
- **bcryptjs** - Password hashing
- **Zod** - Schema validation
- **Node-cron** - Scheduled tasks

## 📦 Workspace Management

This monorepo uses npm workspaces. The root `package.json` defines workspaces for `frontend` and `backend`.

### Installing Dependencies

**Add to a specific workspace:**
```bash
npm install <package> --workspace=frontend
npm install <package> --workspace=backend
```

**Add to root (development tools):**
```bash
npm install -D <package> -w
```

**Install all workspace dependencies:**
```bash
npm install
```

### Running Scripts in Workspaces

```bash
# Run script in specific workspace
npm run <script> --workspace=frontend
npm run <script> --workspace=backend

# Run script in all workspaces
npm run <script> --workspaces
```

## 🗂️ Directory Structure

```
a3-house/
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilities and helpers
│   │   └── ...
│   ├── public/             # Static assets
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── controllers/    # Route controllers
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Mongoose models
│   │   ├── routes/         # API routes
│   │   ├── database/       # Migrations and seeds
│   │   ├── jobs/           # Scheduled jobs
│   │   ├── lib/            # Utility functions
│   │   ├── websocket/      # WebSocket server
│   │   └── server.ts       # Entry point
│   ├── dist/               # Compiled JavaScript (generated)
│   ├── package.json
│   └── tsconfig.json
│
├── package.json            # Root workspace configuration
├── .gitignore             # Git ignore rules
└── README.md              # This file
```

## 🔐 Default Credentials

After running the seed script:

- **Admin Account:**
  - Username: `admin`
  - Password: `admin123`

⚠️ **Important:** Change these credentials in production!

## 🔌 API Documentation

The backend API is documented in [backend/README.md](./backend/README.md).

Main endpoints:
- `POST /api/auth/login` - User authentication
- `GET /api/activities` - List all activities
- `POST /api/sessions` - Create new session
- `GET /api/orders/menu` - Get menu items
- `POST /api/orders` - Create food order
- `POST /api/payments/create-order` - Create payment order

## 🧪 Development

### Running Tests

Tests can be added to each workspace:
```bash
npm test --workspace=frontend
npm test --workspace=backend
```

### Code Quality

```bash
# Lint all workspaces
npm run lint

# Lint specific workspace
npm run lint --workspace=frontend
```

## 🚢 Deployment

### Frontend Deployment

```bash
npm run build:frontend
```

The built files will be in `frontend/dist/` and can be served by any static file server or CDN.

### Backend Deployment

```bash
npm run build:backend
npm start --workspace=backend
```

Ensure environment variables are set in production.

## 📝 Environment Variables

See [frontend/QUICK_START.md](./frontend/QUICK_START.md) for detailed environment variable setup.

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test locally
4. Submit a pull request

## 📄 License

ISC

## 📞 Support

For detailed setup instructions, see:
- Frontend: [frontend/QUICK_START.md](./frontend/QUICK_START.md)
- Backend: [backend/README.md](./backend/README.md)
- MongoDB Setup: [backend/MONGODB_SETUP.md](./backend/MONGODB_SETUP.md)
