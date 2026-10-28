import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto, SendMessageDto } from './dto';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  list() {
    return this.conversations.list();
  }

  @Post()
  create(@Body() dto: CreateConversationDto) {
    return this.conversations.create(dto.title);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.conversations.get(id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.conversations.remove(id);
  }

  @Post(':id/messages')
  sendMessage(@Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.conversations.sendMessage(id, dto.content);
  }
}
