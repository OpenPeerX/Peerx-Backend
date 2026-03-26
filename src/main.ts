import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { csrfMiddleware } from './common/security/csrf.middleware';
import { configureSecurityHeaders } from './common/security/security-headers';
import { configureApiVersioning } from './common/security/api-versioning';
import { VersioningType } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  configureSecurityHeaders(app);
  configureApiVersioning(app);
  app.use(csrfMiddleware);

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('SwapTrade API')
    .setDescription('API documentation for the SwapTrade application - v1 and v2 supported')
    .setVersion('2.0')
    .addTag('auth', 'Authentication endpoints')
    .addTag('swap', 'Token swap endpoints')
    .addTag('user', 'User management endpoints')
    .addTag('portfolio', 'Portfolio management endpoints')
    .addTag('trading', 'Trading endpoints')
    .addTag('rewards', 'Rewards and badges endpoints')
    .addTag('notification', 'Notification endpoints')
    .addTag('bidding', 'Bidding endpoints')
    .addTag('balance', 'Balance management endpoints')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
  console.log('SwapTrade API ready with versioning on port', process.env.PORT ?? 3000);
}
void bootstrap();

