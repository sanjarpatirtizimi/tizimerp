import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DriversModule } from './drivers/drivers.module';
import { DevicesModule } from './devices/devices.module';
import { ProductsModule } from './products/products.module';
import { LedgerModule } from './ledger/ledger.module';
import { HikvisionModule } from './hikvision/hikvision.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AgentModule } from './agent/agent.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { VisitsModule } from './visits/visits.module';
import { FeedbackModule } from './feedback/feedback.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    DriversModule,
    DevicesModule,
    ProductsModule,
    LedgerModule,
    HikvisionModule,
    WebhooksModule,
    AgentModule,
    AnalyticsModule,
    VisitsModule,
    FeedbackModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
