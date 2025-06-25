const fastify = require('fastify')({ logger: true });

async function start() {
  try {
    // Endpoints básicos
    fastify.get('/', async () => ({ 
      message: 'Tampinha API está funcionando!',
      timestamp: new Date().toISOString(),
      status: 'OK'
    }));
    
    fastify.get('/health', async () => ({ 
      status: 'OK',
      timestamp: new Date().toISOString()
    }));

    // Railway usa PORT do ambiente
    const port = process.env.PORT || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    
    console.log(`✅ Servidor rodando na porta ${port}`);
  } catch (err) {
    console.error('❌ Erro:', err);
    process.exit(1);
  }
}

start(); 