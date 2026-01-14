# Render Deployment Guide

## Setup Instructions

1. **Create a new Web Service on Render:**
   - Go to [render.com](https://render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the repository

2. **Configure the Service:**
   - **Name:** `a3-house-backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install --include=dev && npm run build`
   - **Start Command:** `npm start`
   - **Root Directory:** `backend` (important: set this if deploying from monorepo root)

3. **Set Environment Variables in Render Dashboard:**
   ```
   NODE_ENV=production
   PORT=10000
   MONGODB_URI=your_mongodb_connection_string
   REDIS_URL=your_redis_connection_string
   FRONTEND_URL=https://your-frontend-url.vercel.app
   JWT_SECRET=your_jwt_secret
   RAZORPAY_KEY_ID=your_razorpay_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_key_secret
   BACKEND_URL=https://your-backend-url.onrender.com (will be set automatically by Render)
   ```

4. **Keep-Alive Service:**
   - The backend includes an automatic keep-alive service that pings itself every 5 minutes
   - This prevents the service from sleeping on Render's free tier
   - The keep-alive uses `RENDER_EXTERNAL_URL` environment variable (automatically set by Render)
   - You can also manually set `BACKEND_URL` if needed

5. **Alternative: External Keep-Alive Services (Backup):**
   - **UptimeRobot** (Free): https://uptimerobot.com
     - Create a monitor for: `https://your-backend-url.onrender.com/health`
     - Set interval to 5 minutes
   
   - **cron-job.org** (Free): https://cron-job.org
     - Create a cron job that pings: `https://your-backend-url.onrender.com/health`
     - Set to run every 5 minutes

## Important Notes

- **Free Tier Limitations:** Render's free tier spins down after 15 minutes of inactivity
- **Keep-Alive:** The built-in keep-alive service helps, but using an external service as backup is recommended
- **WebSocket Support:** Render supports WebSockets, so your Socket.io connections will work
- **Health Check:** The `/health` endpoint is used for keep-alive pings

## Troubleshooting

- If the service still sleeps, check that `RENDER_EXTERNAL_URL` is set correctly
- Verify the keep-alive logs in Render's service logs
- Consider upgrading to Render's paid plan ($7/month) for always-on service
