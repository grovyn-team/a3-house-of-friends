import cron from 'node-cron';
import https from 'https';
import http from 'http';

const KEEP_ALIVE_INTERVAL = process.env.KEEP_ALIVE_INTERVAL || '*/5 * * * *';

export const startKeepAlive = () => {
  const backendUrl = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL;
  
  if (!backendUrl || backendUrl.includes('localhost')) {
    console.log('⏭️  Keep-alive skipped (local development or URL not set)');
    return;
  }

  const healthCheckUrl = `${backendUrl}/health`;
  
  try {
    const url = new URL(healthCheckUrl);
    const client = url.protocol === 'https:' ? https : http;

    console.log(`🔄 Keep-alive service started. Pinging ${healthCheckUrl} every 5 minutes`);

    cron.schedule(KEEP_ALIVE_INTERVAL, () => {
      try {
        const req = client.get(healthCheckUrl, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            if (res.statusCode === 200) {
              console.log(`✅ Keep-alive ping successful at ${new Date().toISOString()}`);
            } else {
              console.warn(`⚠️  Keep-alive ping returned status ${res.statusCode}`);
            }
          });
        });

        req.on('error', (error) => {
          console.error(`❌ Keep-alive ping failed:`, error.message);
        });

        req.setTimeout(10000, () => {
          req.destroy();
          console.warn('⚠️  Keep-alive ping timeout');
        });
      } catch (error: any) {
        console.error('❌ Keep-alive error:', error.message);
      }
    });
  } catch (error: any) {
    console.error('❌ Failed to initialize keep-alive:', error.message);
  }
};
