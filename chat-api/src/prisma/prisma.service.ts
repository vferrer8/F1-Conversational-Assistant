import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    // Prisma 7 se conecta a través de un driver adapter. Para pasar a Postgres
    // (p. ej. Cloud SQL) basta con cambiar el adapter y el provider del schema.
    super({ adapter: new PrismaBetterSqlite3({ url: config.get('DATABASE_URL', 'file:./data/chat.db') }) });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
