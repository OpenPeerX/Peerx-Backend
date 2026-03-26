import { INestApplication, VersioningType } from '@nestjs/common';

export function configureApiVersioning(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.HEADER,
    header: 'Accept',
    defaultVersion: '1',
  });
}
