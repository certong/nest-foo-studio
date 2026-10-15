import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { ErrorFilter } from './common/error.filter';
import { HealthController } from './health/health.controller';
import { PortalModule } from './portal/portal.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PortalModule],
  controllers: [HealthController],
  providers: [
    // Request bodies, queries and params are parsed with the contract's zod schemas…
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // …and replies are checked against them on the way out.
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: ErrorFilter },
  ],
})
export class AppModule {}
