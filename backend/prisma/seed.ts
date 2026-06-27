import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Agents that ship with the platform and must exist in the registry. */
const AGENTS = [
  {
    id: 'job-agent',
    name: 'Job Hunter',
    description:
      'Finds jobs, scores them against your resume, drafts tailored cover letters, and tracks your applications.',
    enabled: true,
  },
  {
    id: 'data-analyst',
    name: 'Data Analyst',
    description:
      'Ask questions about your data in plain English — it writes and self-corrects read-only SQL across your jobs, meetings, conversations, and usage, then explains the results.',
    enabled: true,
  },
];

async function main(): Promise<void> {
  for (const agent of AGENTS) {
    await prisma.agent.upsert({
      where: { id: agent.id },
      create: agent,
      update: { name: agent.name, description: agent.description, enabled: agent.enabled },
    });
    console.log(`Seeded agent: ${agent.id}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
