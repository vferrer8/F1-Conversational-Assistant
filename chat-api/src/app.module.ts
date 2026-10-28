import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentModule } from './agent/agent.module';
import { ConversationsModule } from './conversations/conversations.module';
import { F1Module } from './f1/f1.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AgentModule, ConversationsModule, F1Module],
  controllers: [HealthController],
})
export class AppModule {}
