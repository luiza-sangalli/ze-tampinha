const fastify = require('fastify')({ logger: true });

async function start() {
  try {
    // Endpoints básicos
    fastify.get('/', async () => ({ 
      message: 'Tampinha API está funcionando!',
      timestamp: new Date().toISOString(),
      status: 'OK',
      port: process.env.PORT || 3000,
      env: process.env.NODE_ENV || 'development'
    }));
    
    fastify.get('/health', async () => ({ 
      status: 'OK',
      timestamp: new Date().toISOString(),
      port: process.env.PORT || 3000
    }));

    // Railway define PORT automaticamente
    const port = process.env.PORT || 3000;
    const host = '0.0.0.0';
    
    await fastify.listen({ port: parseInt(port), host });
    
    console.log(`✅ Tampinha Server rodando!`);
    console.log(`🌐 Porta: ${port}`);
    console.log(`🏠 Host: ${host}`);
    console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  } catch (err) {
    console.error('❌ Erro ao iniciar servidor:', err);
    process.exit(1);
  }
}

start(); 