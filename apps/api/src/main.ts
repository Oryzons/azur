import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { json, raw, urlencoded } from 'express';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/** Photos MVP en data URL : dépasse la limite Express par défaut (100 ko). */
const JSON_BODY_LIMIT = '25mb';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });
  /** Corps brut obligatoire pour stripe.webhooks.constructEvent (signature HMAC). */
  app.use('/api/v1/webhooks/stripe', raw({ type: 'application/json' }));
  app.use(json({ limit: JSON_BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));
  const config = app.get(ConfigService);
  const port = config.get<number>('API_PORT', 3001);

  app.enableCors({
    origin: [config.get('ADMIN_URL', 'http://localhost:5173')],
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(port);
  new Logger('Bootstrap').log(`API http://localhost:${port}`);
}
bootstrap();
