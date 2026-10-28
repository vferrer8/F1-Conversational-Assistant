import { Injectable, NotFoundException } from '@nestjs/common';
import { AgentClient, ChatTurn } from '../agent/agent.client';
import { PrismaService } from '../prisma/prisma.service';

/** Mensajes previos que se envían al agente como contexto. */
const HISTORY_WINDOW = 20;
const DEFAULT_TITLE = 'Nueva conversación';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agent: AgentClient,
  ) {}

  list() {
    return this.prisma.conversation.findMany({
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
  }

  create(title?: string) {
    return this.prisma.conversation.create({ data: { title: title?.trim() || DEFAULT_TITLE } });
  }

  async get(id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) throw new NotFoundException('Conversación no encontrada.');
    return { ...conversation, messages: conversation.messages.map(parseMetadata) };
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.conversation.delete({ where: { id } });
  }

  async sendMessage(conversationId: string, content: string) {
    const conversation = await this.ensureExists(conversationId);

    const previous = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_WINDOW,
    });
    const history: ChatTurn[] = previous
      .reverse()
      .map((m) => ({ role: m.role as ChatTurn['role'], content: m.content }));

    const userMessage = await this.prisma.message.create({
      data: { conversationId, role: 'user', content },
    });

    const reply = await this.agent.query(content, history, conversationId);

    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: reply.answer,
        metadata: JSON.stringify({
          status: reply.status,
          model: reply.model,
          toolCalls: reply.tool_calls,
          consistencySuspects: reply.consistency_suspects,
          latencyMs: reply.latency_ms,
          runId: reply.run_id,
        }),
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        // La primera pregunta da título a la conversación.
        title: conversation.title === DEFAULT_TITLE ? content.slice(0, 60) : undefined,
        updatedAt: new Date(),
      },
    });

    return { userMessage: parseMetadata(userMessage), assistantMessage: parseMetadata(assistantMessage) };
  }

  private async ensureExists(id: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id } });
    if (!conversation) throw new NotFoundException('Conversación no encontrada.');
    return conversation;
  }
}

function parseMetadata<T extends { metadata: string | null }>(m: T) {
  return { ...m, metadata: m.metadata ? JSON.parse(m.metadata) : null };
}
