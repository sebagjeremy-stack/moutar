import 'reflect-metadata';
import { Logger, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

/** Taille maximale d'un corps JSON (lot 1 : 100 Ko ; lot 2 : 1 Mo pour l'import des lignes corrigées d'une liste). */
const LIMITE_CORPS = '1mb';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  // Corps JSON jusqu'à 1 Mo (lot 2 : l'import d'une liste corrigée à l'aperçu, quelques milliers de lignes) ; au-delà, 413.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.useBodyParser('json', { limit: LIMITE_CORPS });
  app.useBodyParser('urlencoded', { extended: true, limit: LIMITE_CORPS });
  app.disable('x-powered-by');
  // En-têtes de sécurité (helmet, réglages par défaut) : en production, une CSP stricte — l'image du produit ne vient que
  // d'Open Food Facts — ; en développement, pas de CSP (Vite sert l'écran et injecte ses scripts). Jamais de Referer.
  app.use(
    helmet({
      contentSecurityPolicy:
        env.NODE_ENV === 'production'
          ? { directives: { defaultSrc: ["'self'"], imgSrc: ["'self'", 'https://images.openfoodfacts.org', 'https://static.openfoodfacts.org', 'data:'], connectSrc: ["'self'"] } }
          : false,
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  if (env.NODE_ENV === 'production') app.set('trust proxy', 1);
  // Toutes les routes : /api/v1/…
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();
  // Développement : un processus dont le parent (le watcher) a disparu s'arrête seul (port 3100 libéré).
  if (env.NODE_ENV !== 'production') {
    setInterval(() => {
      if (process.ppid === 1) process.exit(0);
    }, 2_000).unref();
  }
  await app.listen(env.PORT_API);
  new Logger('Bootstrap').log(`API démarrée → http://localhost:${env.PORT_API}/api/v1/health`);
}

void bootstrap();
