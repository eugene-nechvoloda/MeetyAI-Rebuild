/**
 * MeetyAI Rebuild - Main Server Entry Point
 *
 * Dual-AI transcript analysis with Claude Sonnet 4.5 + GPT-5
 */

import pkg from '@slack/bolt';
const { App, ExpressReceiver } = pkg;
import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize logger
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    },
  },
});

// Initialize Prisma
export const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

// Log Prisma queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e: any) => {
    logger.debug(`Query: ${e.query}`);
  });
}

prisma.$on('error', (e: any) => {
  logger.error('Prisma error:', e);
});

prisma.$on('warn', (e: any) => {
  logger.warn('Prisma warning:', e);
});

// Initialize Slack Bolt with ExpressReceiver
// ExpressReceiver automatically handles:
// - URL verification challenges (responds with {"challenge": "..."})
// - SSL checks
// - Signature verification
// - Body parsing
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  endpoints: '/slack/events',
});

// Configure Express to trust Railway's proxy for correct IP/protocol detection
receiver.app.set('trust proxy', true);

export const slack = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver,
});

// Root endpoint for Railway health check
receiver.router.get('/', (req, res) => {
  res.json({
    app: 'MeetyAI',
    status: 'running',
    version: '2.0.0',
  });
});

// Health check endpoint
receiver.router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    slack: {
      endpoint: '/slack/events',
      configured: !!process.env.SLACK_BOT_TOKEN && !!process.env.SLACK_SIGNING_SECRET,
    },
  });
});

// Debug endpoint to test Slack configuration
receiver.router.get('/debug/slack', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    slack_bot_token: process.env.SLACK_BOT_TOKEN ? `${process.env.SLACK_BOT_TOKEN.substring(0, 10)}...` : 'NOT SET',
    slack_signing_secret: process.env.SLACK_SIGNING_SECRET ? `${process.env.SLACK_SIGNING_SECRET.substring(0, 8)}...` : 'NOT SET',
    endpoint: '/slack/events',
    message: 'Slack Bolt should automatically handle challenge verification at POST /slack/events',
  });
});

// Start server
const PORT = process.env.PORT || 5000;

(async () => {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('✅ Database connected');

    // Test AI API keys
    if (!process.env.ANTHROPIC_API_KEY) {
      logger.warn('⚠️  ANTHROPIC_API_KEY not set');
    }
    if (!process.env.OPENAI_API_KEY) {
      logger.warn('⚠️  OPENAI_API_KEY not set');
    }

    // Log Slack configuration
    logger.info({
      bot_token: process.env.SLACK_BOT_TOKEN ? `${process.env.SLACK_BOT_TOKEN.substring(0, 10)}...` : 'NOT SET',
      signing_secret: process.env.SLACK_SIGNING_SECRET ? `${process.env.SLACK_SIGNING_SECRET.substring(0, 8)}...` : 'NOT SET',
    }, '🔐 Slack credentials configured');

    // Register Slack handlers after exports are complete (avoid circular dependency)
    await import('./slack/handlers.js');

    // Start server - bind to 0.0.0.0 for Railway
    const PORT_NUM = parseInt(PORT.toString(), 10);
    const server = receiver.app.listen(PORT_NUM, '0.0.0.0', () => {
      logger.info(`⚡️ MeetyAI server running on port ${PORT_NUM}`);
      logger.info(`📊 Dual-AI processing: Claude Sonnet 4.5 + GPT-5`);
      logger.info(`🔗 Health check: http://localhost:${PORT_NUM}/health`);
      logger.info(`🤖 Slack events: POST /slack/events`);
      logger.info(`💡 Railway URL: https://meetyai-rebuild-production.up.railway.app`);
    });

    // Ensure server is accessible
    server.on('error', (err) => {
      logger.error({ error: err }, '❌ Server error');
      process.exit(1);
    });

  } catch (error) {
    logger.error({ error }, '❌ Failed to start server');
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});
