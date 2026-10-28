import { Global, Module } from '@nestjs/common';
import { AgentClient } from './agent.client';

@Global()
@Module({
  providers: [AgentClient],
  exports: [AgentClient],
})
export class AgentModule {}
