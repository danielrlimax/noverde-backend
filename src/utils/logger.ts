import winston from 'winston';
import path from 'path';
import { env } from '../config/env';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  })
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    ),
  }),
];

// Adiciona arquivo de log em produção
if (env.isProd) {
  const logDir = path.dirname(env.logs.file);
  
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: env.logs.file,
      format: logFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    })
  );
}

export const logger = winston.createLogger({
  level: env.logs.level,
  transports,
  exitOnError: false,
});

// Stream para Morgan
export const morganStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};
