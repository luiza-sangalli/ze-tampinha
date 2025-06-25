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

// Register plugins
async function build() {
  // Security
  await fastify.register(require('helmet'));
  
  // CORS
  await fastify.register(require('@fastify/cors'), {
    origin: true
  });

  // Rate limiting for scalability
  await fastify.register(require('@fastify/rate-limit'), {
    max: 100,
    timeWindow: '1 minute'
  });

  // JWT authentication
  await fastify.register(require('@fastify/jwt'), {
    secret: process.env.JWT_SECRET
  });

  // Database connection
  await fastify.register(require('./plugins/database'));
  
  // Redis connection
  await fastify.register(require('./plugins/redis'));

  // Routes
  await fastify.register(require('./routes/auth'), { prefix: '/api/auth' });
  await fastify.register(require('./routes/users'), { prefix: '/api/users' });
  await fastify.register(require('./routes/qrcode'), { prefix: '/api/qr-codes' });
  await fastify.register(require('./routes/points'), { prefix: '/api/points' });
  await fastify.register(require('./routes/rewards'), { prefix: '/api/rewards' });
  await fastify.register(require('./routes/whatsapp'), { prefix: '/api/whatsapp' });
  await fastify.register(require('./routes/telegram'), { prefix: '/api/telegram' });

  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    return { status: 'OK', timestamp: new Date().toISOString() };
  });

  // Temporary migration endpoint
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

  return fastify;
}

// Start server
async function start() {
  try {
    const server = await build();
    const port = process.env.PORT || 3000;
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
    
    await server.listen({ port, host });
    console.log(`🚀 Server running on http://${host}:${port}`);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = { build }; 