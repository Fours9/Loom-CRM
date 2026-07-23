import { Global, Module } from '@nestjs/common';
import { getApplicationConfig } from './application-config';

export const APPLICATION_CONFIG = Symbol('APPLICATION_CONFIG');

@Global()
@Module({
  providers: [
    {
      provide: APPLICATION_CONFIG,
      useFactory: () => getApplicationConfig(),
    },
  ],
  exports: [APPLICATION_CONFIG],
})
export class ApplicationConfigModule {}
