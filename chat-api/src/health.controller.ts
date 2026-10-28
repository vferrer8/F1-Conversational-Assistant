import { Controller, Get } from '@nestjs/common';
import { AgentClient } from './agent/agent.client';

@Controller('health')
export class HealthController {
  constructor(private readonly agent: AgentClient) {}

  @Get()
  async health() {
    return { status: 'ok', agentService: (await this.agent.isHealthy()) ? 'ok' : 'unreachable' };
  }
}
