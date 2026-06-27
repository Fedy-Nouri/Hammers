import { Module } from '@nestjs/common';
import { SqlExecutorService } from './sql-executor.service';
import { SchemaService } from './schema.service';
import { AnalystService } from './analyst.service';

/**
 * Data Analyst agent (DA). PrismaService and ConfigService are global, so this module
 * needs no imports. AnalystService runs the LangGraph NL→SQL graph and is consumed by
 * AiController (which imports this module) to route data-analyst chats.
 */
@Module({
  providers: [SqlExecutorService, SchemaService, AnalystService],
  exports: [AnalystService],
})
export class DataAnalystModule {}
