const fastify = require('fastify')({ 
  logger: {
    level: process.env.LOG_LEVEL || 'info'
  }
});
const path = require('path');

// Only load .env in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Helper function to check if DATABASE_URL is valid
function isValidDatabaseUrl(url) {
  if (!url) return false;
  if (url.includes('username') || url.includes('password')) return false; // Template values
  return url.startsWith('postgresql://') || url.startsWith('postgres://');
}

// Register plugins
async function build() {
  try {
    // CORS - essential for API
    await fastify.register(require('@fastify/cors'), {
      origin: true
    });

    // Rate limiting for scalability - simplified
    await fastify.register(require('@fastify/rate-limit'), {
      max: 100,
      timeWindow: '1 minute'
    });

    // JWT authentication - with fallback
    await fastify.register(require('@fastify/jwt'), {
      secret: process.env.JWT_SECRET || 'tampinha-fallback-secret-2024'
    });

    const hasValidDatabase = isValidDatabaseUrl(process.env.DATABASE_URL);
    const hasValidRedis = process.env.REDIS_URL && !process.env.REDIS_URL.includes('redis://localhost');

    // Database connection - only if valid DATABASE_URL
    if (hasValidDatabase) {
      await fastify.register(require('./plugins/database'));
      fastify.log.info('Database plugin registered');
    } else {
      fastify.log.warn('DATABASE_URL not valid, running without database');
    }
    
    // Redis connection - only if valid REDIS_URL
    if (hasValidRedis) {
      await fastify.register(require('./plugins/redis'));
      fastify.log.info('Redis plugin registered');
    } else {
      fastify.log.warn('REDIS_URL not valid, running without Redis');
    }

    // Routes - only register if database is available
    if (hasValidDatabase) {
      await fastify.register(require('./routes/auth'), { prefix: '/api/auth' });
      await fastify.register(require('./routes/users'), { prefix: '/api/users' });
      await fastify.register(require('./routes/qrcode'), { prefix: '/api/qr-codes' });
      await fastify.register(require('./routes/points'), { prefix: '/api/points' });
      await fastify.register(require('./routes/rewards'), { prefix: '/api/rewards' });
      await fastify.register(require('./routes/whatsapp'), { prefix: '/api/whatsapp' });
      await fastify.register(require('./routes/telegram'), { prefix: '/api/telegram' });
      fastify.log.info('API routes registered');
    } else {
      fastify.log.warn('Running in demo mode - no API routes available');
    }

    // Health check endpoint
    fastify.get('/health', async (request, reply) => {
      return { 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        database: hasValidDatabase,
        redis: hasValidRedis,
        mode: hasValidDatabase ? 'full' : 'demo'
      };
    });

    // Root endpoint
    fastify.get('/', async (request, reply) => {
      return {
        message: 'Tampinha Loyalty System API',
        version: '1.0.0',
        status: 'running',
        environment: process.env.NODE_ENV || 'development',
        database: hasValidDatabase,
        redis: hasValidRedis,
        mode: hasValidDatabase ? 'full' : 'demo',
        endpoints: {
          health: '/health',
          ...(hasValidDatabase && {
            auth: '/api/auth',
            users: '/api/users',
            qrCodes: '/api/qr-codes',
            points: '/api/points',
            rewards: '/api/rewards',
            whatsapp: '/api/whatsapp',
            telegram: '/api/telegram'
          })
        }
      };
    });

    // Temporary migration endpoint - only if database is available
    if (hasValidDatabase) {
      fastify.post('/admin/migrate', async (request, reply) => {
        try {
          const runMigrations = require('./database/migrations/run');
          await runMigrations();
          return { success: true, message: 'Migrations completed successfully!' };
        } catch (error) {
          fastify.log.error('Migration failed:', error);
          return reply.code(500).send({ 
            success: false, 
            error: error.message 
          });
        }
      });
    }

    return fastify;
  } catch (error) {
    console.error('Error building server:', error);
    throw error;
  }
}

// Start server
async function start() {
  try {
    const server = await build();
    const port = process.env.PORT || 3000;
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
    
    await server.listen({ port, host });
    console.log(`🚀 Tampinha Server running on http://${host}:${port}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Health Check: http://${host}:${port}/health`);
    console.log(`💾 Database: ${isValidDatabaseUrl(process.env.DATABASE_URL) ? 'Connected' : 'Not configured'}`);
    console.log(`🔴 Redis: ${process.env.REDIS_URL && !process.env.REDIS_URL.includes('localhost') ? 'Connected' : 'Not configured'}`);
    console.log(`🎯 Mode: ${isValidDatabaseUrl(process.env.DATABASE_URL) ? 'Full API' : 'Demo Mode'}`);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = { build }; 