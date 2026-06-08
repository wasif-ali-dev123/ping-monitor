export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  ping: {
    url: process.env.PING_URL ?? 'https://httpbin.org/anything',
    timeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS ?? '10000', 10),
    cron: process.env.PING_CRON ?? '*/5 * * * *',
  },
});
