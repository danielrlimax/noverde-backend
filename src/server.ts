import express from 'express';
import morgan from 'morgan';
import { env } from './config/env';
import { testConnection } from './config/supabase';
import { applySecurityMiddleware } from './middleware/security';
import { firewall, validateRequestBody, limitBodyFields, enforceContentType } from './middleware/firewall';
import { generalLimiter } from './middleware/rateLimiter';
import { notFoundHandler, errorHandler, setupGlobalErrorHandlers } from './middleware/errorHandler';
import { logger, morganStream } from './utils/logger';
import routes from './routes';

// Configura handlers globais de erro
setupGlobalErrorHandlers();

const app = express();

// Trust proxy (necessário para Render, Vercel, Heroku)
app.set('trust proxy', true);

// Aplica middlewares de segurança (Helmet, CORS, HPP, etc)
applySecurityMiddleware(app);

// Firewall - primeira linha de defesa
app.use(firewall);

// Body parsers com limite
app.use(express.json({ 
  limit: '10kb',
  strict: true,
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10kb',
  parameterLimit: 50,
}));

// Validações adicionais do body
app.use(enforceContentType);
app.use(validateRequestBody);
app.use(limitBodyFields(30));

// Logging HTTP
if (env.isDev) {
  app.use(morgan('dev'));
} else {
  app.use(morgan(':remote-addr - :method :url :status :res[content-length] - :response-time ms', { 
    stream: morganStream,
    skip: (req) => req.path === '/health' || req.path === '/api/v1/health',
  }));
}

// Rate limiting global
app.use(generalLimiter);

// Health check (antes das rotas para não precisar de auth)
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'OK',
    timestamp: new Date().toISOString(),
    environment: env.nodeEnv,
  });
});

app.get('/api/v1/health', (_req, res) => {
  res.json({
    success: true,
    message: 'API SolVerde funcionando',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Rotas da API
app.use('/api/v1', routes);

// Rota raiz
app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'SolVerde API',
    version: '1.0.0',
    documentation: '/api/v1/health',
  });
});

// Handler para rotas não encontradas
app.use(notFoundHandler);

// Handler global de erros (deve ser o último)
app.use(errorHandler);

// Inicia servidor
async function startServer(): Promise<void> {
  try {
    // Testa conexão com Supabase
    let connected = false;
    try {
      connected = await testConnection();
    } catch (err) {
      logger.warn('Não foi possível testar conexão com Supabase:', err);
    }

    const server = app.listen(env.port, () => {
      logger.info(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🌞 SolVerde API Server v1.0.0                               ║
║                                                               ║
║   Ambiente:  ${env.nodeEnv.padEnd(45)}║
║   Porta:     ${String(env.port).padEnd(45)}║
║   URL:       http://localhost:${env.port.toString().padEnd(33)}║
║                                                               ║
║   Supabase:  ${(connected ? 'Conectado ✓' : 'Verificar config').padEnd(45)}║
║   Segurança: Firewall + Helmet + CORS + Rate Limit           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    const gracefulShutdown = (signal: string) => {
      logger.info(`${signal} recebido. Iniciando shutdown graceful...`);
      server.close(() => {
        logger.info('Servidor encerrado');
        process.exit(0);
      });

      // Força encerramento após 10 segundos
      setTimeout(() => {
        logger.error('Shutdown forçado após timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();

export default app;
