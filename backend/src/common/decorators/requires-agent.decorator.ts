import { SetMetadata } from '@nestjs/common';

export const REQUIRES_AGENT = 'requiresAgent';

/** Marks a controller/route as requiring the given agent be installed + allowed by plan. */
export const RequiresAgent = (agentId: string) => SetMetadata(REQUIRES_AGENT, agentId);
