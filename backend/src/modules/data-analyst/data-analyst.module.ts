import { Module } from '@nestjs/common';
import { SqlExecutorService } from './sql-executor.service';
import { SchemaService } from './schema.service';

/**
 * Data Analyst agent (DA). PrismaService and ConfigService are global, so this module
 * needs no imports. DA-002 adds the LangGraph AnalystService here.
 */
@Module({
  providers: [SqlExecutorService, SchemaService],
  exports: [SqlExecutorService, SchemaService],
})
export class DataAnalystModule {}
