console.log('🚀 Iniciando Tampinha Server...');
console.log('📊 NODE_ENV:', process.env.NODE_ENV);
console.log('🌐 PORT:', process.env.PORT);
console.log('🏠 HOST: 0.0.0.0');

const fastify = require('fastify')({ 
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: false
      }
    }
  }
});

async function start() {
  try {
    console.log('⚙️ Configurando rotas...');
    
    // Endpoints básicos
    fastify.get('/', async (request, reply) => {
      console.log('📥 Requisição recebida na rota /');
      return { 
        message: 'Tampinha API está funcionando!',
        timestamp: new Date().toISOString(),
        status: 'OK',
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV || 'development',
        host: '0.0.0.0'
      };
    });
    
    fastify.get('/health', async (request, reply) => {
      console.log('🏥 Health check requisitado');
      return { 
        status: 'OK',
        timestamp: new Date().toISOString(),
        port: process.env.PORT || 3000,
        uptime: process.uptime()
      };
    });

    console.log('🔧 Configurando servidor...');
    
    // Railway define PORT automaticamente
    const port = parseInt(process.env.PORT) || 3000;
    const host = '0.0.0.0';
    
    console.log(`🎯 Tentando iniciar servidor na porta ${port}...`);
    
    await fastify.listen({ port, host });
    
    console.log(`✅ SUCESSO! Tampinha Server rodando!`);
    console.log(`🌐 Porta: ${port}`);
    console.log(`🏠 Host: ${host}`);
    console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🕐 Horário: ${new Date().toISOString()}`);
    
  } catch (err) {
    console.error('❌ ERRO CRÍTICO ao iniciar servidor:');
    console.error('📋 Detalhes do erro:', err);
    console.error('🔍 Stack trace:', err.stack);
    console.error('🌐 Porta tentada:', process.env.PORT || 3000);
    console.error('🏠 Host tentado: 0.0.0.0');
    process.exit(1);
  }
}

// Capturar sinais do sistema
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM recebido, encerrando servidor...');
  fastify.close();
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT recebido, encerrando servidor...');
  fastify.close();
});

console.log('🎬 Iniciando função start()...');
start(); 