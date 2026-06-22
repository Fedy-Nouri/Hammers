/** Stable id of the Job Application Agent in the Agent registry (seeded). */
export const JOB_AGENT_ID = 'job-agent';

/** Lifecycle states for a tracked job application; also the kanban columns. */
export const JOB_STATUSES = [
  'new',
  'saved',
  'applied',
  'interview',
  'offer',
  'rejected',
  'dismissed',
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];
