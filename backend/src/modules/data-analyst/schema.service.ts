import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ANALYST_VIEWS } from './data-analyst.constants';

interface ColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
}

/**
 * Describes the analyst_* views as compact text for the SQL-writing model. The schema
 * is static, so the result is memoized after the first call.
 */
@Injectable()
export class SchemaService {
  constructor(private readonly prisma: PrismaService) {}

  private cache: string | null = null;

  async describe(): Promise<string> {
    if (this.cache !== null) return this.cache;

    const names = ANALYST_VIEWS.map((v) => `'${v}'`).join(', ');
    const rows = await this.prisma.$queryRawUnsafe<ColumnRow[]>(
      `SELECT table_name, column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name IN (${names})
       ORDER BY table_name, ordinal_position`,
    );

    const byTable = new Map<string, string[]>();
    for (const row of rows) {
      const cols = byTable.get(row.table_name) ?? [];
      cols.push(`${row.column_name} ${row.data_type}`);
      byTable.set(row.table_name, cols);
    }

    this.cache = [...byTable.entries()]
      .map(([table, cols]) => `${table}(${cols.join(', ')})`)
      .join('\n');
    return this.cache;
  }
}
