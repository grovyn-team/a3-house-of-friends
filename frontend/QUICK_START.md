# 🚀 Quick Start Guide - a3houseoffriends

## Prerequisites

Before starting, ensure you have installed:
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **MongoDB** (v6 or higher) - [Download](https://www.mongodb.com/try/download/community)
- **Redis** (v7 or higher) - [Download](https://redis.io/download)

---

## Step 1: Install Dependencies

### Backend Dependencies
```bash
cd backend
npm install
```

### Frontend Dependencies
```bash
# From project root
npm install
```

---

## Step 2: Set Up Environment Variables

### Backend Environment (.env)

Create `backend/.env` file:

```bash
cd backend
touch .env
```

Add the following content:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# MongoDB
MONGODB_URI=mongodb://localhost:27017/a3houseoffriends

# Redis
REDIS_URL=redis://localhost:6379

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key_change_in_production_12345
JWT_EXPIRES_IN=7d

# Razorpay (Optional - for payments)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_secret_key
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

### Frontend Environment (.env)

Create `.env` file in project root:

```bash
# From project root
touch .env
```

Add the following content:

```env
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=http://localhost:3000
```

---

## Step 3: Start MongoDB

### macOS (using Homebrew)
```bash
# Install MongoDB (if not installed)
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB service
brew services start mongodb-community
```

### Linux
```bash
# Start MongoDB service
sudo systemctl start mongod
```

### Windows
```bash
# Start MongoDB service
net start MongoDB
```

### Verify MongoDB is Running
```bash
mongosh
# Or
mongo
```

You should see MongoDB shell. Type `exit` to leave.

---

## Step 4: Start Redis

### macOS (using Homebrew)
```bash
# Install Redis (if not installed)
brew install redis

# Start Redis service
brew services start redis
```

### Linux
```bash
# Install Redis (if not installed)
sudo apt-get install redis-server

# Start Redis service
sudo systemctl start redis-server
```

### Using Docker (Alternative)
```bash
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

### Verify Redis is Running
```bash
redis-cli ping
```

You should see: `PONG`

---

## Step 5: Seed the Database

Run the seed script to create initial data (admin user, activities, menu items):

```bash
cd backend
npm run seed
```

**Expected Output:**
```
✅ Database seeded successfully
✅ Admin user created: admin / admin123
✅ Activities created
✅ Menu items created
```

**Default Admin Credentials:**
- **Username:** `admin`
- **Password:** `admin123`

> 💡 **Note:** You can also create new accounts using the Register page at `/admin/register`

---

## Step 6: Start the Backend Server

```bash
cd backend
npm run dev
```

**Expected Output:**
```
✅ MongoDB connected successfully
   Database: a3houseoffriends
✅ Redis connected
✅ WebSocket server initialized
✅ Cron jobs initialized
🚀 Server running on port 3000
📡 Environment: development
🌐 Frontend URL: http://localhost:5173
⚡ WebSocket server initialized
```

**Keep this terminal open!**

---

## Step 7: Start the Frontend Server

Open a **new terminal** window:

```bash
# From project root
npm run dev
```

**Expected Output:**
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

## Step 8: Access the Application

### Customer Flow (QR Code)
Open in browser: **http://localhost:5173/**

### Admin Dashboard
Open in browser: **http://localhost:5173/admin/login**

**Login Credentials:**
- **Username:** `admin`
- **Password:** `admin123`

**Or Register New Account:**
- Go to: **http://localhost:5173/admin/register**
- Fill in the registration form
- Choose role: Staff or Admin

---

## 🧪 Testing the Setup

### 1. Test Backend Health
```bash
curl http://localhost:3000/health
```

Should return:
```json
{"status":"ok","timestamp":"2025-01-XX..."}
```

### 2. Test MongoDB Connection
```bash
cd backend
npm run check-db
```

Should show:
```
✅ MongoDB connected successfully
```

### 3. Test Redis Connection
```bash
redis-cli ping
```

Should return: `PONG`

### 4. Test WebSocket Connection
1. Open browser console (F12)
2. Navigate to http://localhost:5173/
3. Look for: `✅ WebSocket connected to customer`

---

## 📱 Testing the Booking Flow

1. **Open Landing Page**
   - Go to: http://localhost:5173/
   - You should see available activities

2. **Select an Activity**
   - Click on any activity card
   - Fill in customer details
   - Select duration
   - Click "Book Now"

3. **Complete Payment**
   - Choose "Cash Payment" or "Online Payment"
   - If cash: Payment confirmed immediately
   - If online: Use Razorpay test credentials

4. **View Session Timer**
   - After payment, you'll be redirected to timer page
   - Timer should update in real-time (every 10 seconds)

5. **Admin Dashboard**
   - Login at: http://localhost:5173/admin/login
   - View live sessions
   - See real-time updates

---

## 🐛 Troubleshooting

### Backend won't start

**Error: MongoDB connection failed**
```bash
# Check if MongoDB is running
brew services list  # macOS
# or
sudo systemctl status mongod  # Linux

# Start MongoDB if not running
brew services start mongodb-community  # macOS
```

**Error: Redis connection failed**
```bash
# Check if Redis is running
redis-cli ping

# Start Redis if not running
brew services start redis  # macOS
# or
sudo systemctl start redis-server  # Linux
```

**Error: Port 3000 already in use**
```bash
# Find and kill process using port 3000
lsof -ti:3000 | xargs kill -9  # macOS/Linux
```

### Frontend won't start

**Error: Port 5173 already in use**
```bash
# Find and kill process using port 5173
lsof -ti:5173 | xargs kill -9  # macOS/Linux
```

### WebSocket not connecting

1. Check backend is running on port 3000
2. Check `VITE_WS_URL` in frontend `.env`
3. Check browser console for errors
4. Verify CORS settings in backend

### Database not seeded

```bash
cd backend
npm run seed
```

If it fails, check:
- MongoDB is running
- `MONGODB_URI` in `.env` is correct
- Database name matches

---

## 📋 Quick Command Reference

```bash
# Start MongoDB
brew services start mongodb-community  # macOS
sudo systemctl start mongod  # Linux

# Start Redis
brew services start redis  # macOS
sudo systemctl start redis-server  # Linux

# Seed Database
cd backend && npm run seed

# Start Backend
cd backend && npm run dev

# Start Frontend
npm run dev

# Check MongoDB
cd backend && npm run check-db

# Check Redis
redis-cli ping
```

---

## 🎯 Next Steps

1. **Configure Razorpay** (for online payments):
   - Sign up at https://razorpay.com
   - Get test API keys
   - Add to `backend/.env`

2. **Customize Activities**:
   - Login to admin dashboard
   - Add/edit activities and pricing

3. **Add Menu Items**:
   - Use admin dashboard or seed script
   - Customize menu categories

4. **Test Real-Time Features**:
   - Open multiple browser tabs
   - Create a booking in one tab
   - See availability update in other tabs

---

## 📞 Support

If you encounter issues:
1. Check all services are running (MongoDB, Redis)
2. Verify environment variables are set correctly
3. Check terminal logs for error messages
4. Ensure ports 3000 and 5173 are available

---

**Happy Coding! 🎮**

