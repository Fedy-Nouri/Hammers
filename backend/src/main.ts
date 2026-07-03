import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // rawBody captures the unparsed request body (req.rawBody) needed for Stripe webhook
  // signature verification, while JSON parsing still works for every other route.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const configService = app.get(ConfigService);

  // CORS: a comma-separated CORS_ORIGINS allowlist enables split-origin browser deploys
  // (frontend served from its own domain). Unset → allow all in dev for convenience; in
  // production, same-origin only (the nginx reverse-proxy setup needs no CORS headers).
  const corsOrigins = configService.get<string>('CORS_ORIGINS');
  if (corsOrigins) {
    app.enableCors({
      origin: corsOrigins
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
      credentials: true,
    });
  } else if (configService.get<string>('NODE_ENV') !== 'production') {
    app.enableCors({ origin: true, credentials: true });
  }

  // Swagger is exposed in non-production, or anywhere ENABLE_SWAGGER=true is set. Keeping
  // it off in production by default avoids leaking the full API surface at /api/docs.
  const enableSwagger =
    configService.get<string>('NODE_ENV') !== 'production' ||
    configService.get<string>('ENABLE_SWAGGER') === 'true';
  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Hammers API')
      .setDescription('AI Agent SaaS Platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
}

bootstrap();
