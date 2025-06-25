const bcrypt = require('bcrypt');
const Joi = require('joi');

async function authRoutes(fastify, options) {
  // Simple authentication for API access (bars/admin)
  const loginSchema = {
    body: Joi.object({
      username: Joi.string().required(),
      password: Joi.string().required()
    })
  };

  // Login endpoint
  fastify.post('/login', {
    schema: loginSchema
  }, async (request, reply) => {
    try {
      const { username, password } = request.body;

      // Simple hardcoded authentication for demo
      // In production, use proper user management
      const validUsers = {
        'admin': '$2b$10$rQZ9cXrPGF5fF5b0Nt7T0.QZ9cXrPGF5fF5b0Nt7T0Oo1X2Y3Z4A5B', // password: admin123
        'bar_owner': '$2b$10$rQZ9cXrPGF5fF5b0Nt7T0.QZ9cXrPGF5fF5b0Nt7T0Oo1X2Y3Z4A5C' // password: bar123
      };

      const hashedPassword = validUsers[username];
      if (!hashedPassword) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, hashedPassword);
      if (!isValidPassword) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      // Generate JWT token
      const token = fastify.jwt.sign({ 
        username,
        role: username === 'admin' ? 'admin' : 'bar_owner',
        iat: Math.floor(Date.now() / 1000)
      });

      return reply.send({
        success: true,
        token,
        user: {
          username,
          role: username === 'admin' ? 'admin' : 'bar_owner'
        }
      });

    } catch (error) {
      fastify.log.error('Login error:', error);
      return reply.code(500).send({ error: 'Authentication failed' });
    }
  });

  // Verify token endpoint
  fastify.get('/verify', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    return reply.send({
      success: true,
      user: request.user
    });
  });

  // Add authentication decorator
  fastify.decorate('authenticate', async function(request, reply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Authentication required' });
    }
  });
}

module.exports = authRoutes; 