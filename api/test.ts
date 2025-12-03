// @ts-nocheck
export default function handler(req: any, res: any) {
  res.status(200).json({
    status: 'ok',
    message: 'API is working',
    timestamp: new Date().toISOString(),
    env: {
      hasDbUrl: !!process.env.DATABASE_URL,
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasTelegramToken: !!process.env.TELEGRAM_BOT_TOKEN,
      nodeEnv: process.env.NODE_ENV,
      vercel: process.env.VERCEL,
    }
  });
}

