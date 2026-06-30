import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { CreateAgentDto } from './dto/create-agent.dto';
import type { UpdateAgentDto } from './dto/update-agent.dto';

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.agent.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async findOne(id: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) throw new NotFoundException(`Agent "${id}" not found`);
    return agent;
  }

  async create(dto: CreateAgentDto) {
    const exists = await this.prisma.agent.findUnique({ where: { id: dto.id } });
    if (exists) throw new ConflictException(`Agent id "${dto.id}" is already taken`);
    return this.prisma.agent.create({
      data: {
        id: dto.id,
        name: dto.name,
        description: dto.description,
        enabled: dto.enabled ?? true,
        ...(dto.minPlan && { minPlan: dto.minPlan }),
        configuration: (dto.configuration ?? {}) as object,
      },
    });
  }

  async update(id: string, dto: UpdateAgentDto) {
    await this.findOne(id);
    return this.prisma.agent.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        ...(dto.minPlan !== undefined && { minPlan: dto.minPlan }),
        ...(dto.configuration !== undefined && { configuration: dto.configuration as object }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.agent.delete({ where: { id } });
  }
}
