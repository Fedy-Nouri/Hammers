import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { GoogleIntegrationService } from '../google-integration/google-integration.service';
import { Meeting, Prisma } from '@prisma/client';

const MEET_LINK_REGEX = /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/;

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email: string }>;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType: string; uri: string }>;
  };
}

interface CalendarEventsResponse {
  items?: GoogleCalendarEvent[];
  nextSyncToken?: string;
  nextPageToken?: string;
}

@Injectable()
export class MeetingSyncService {
  private readonly logger = new Logger(MeetingSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleService: GoogleIntegrationService,
  ) {}

  async syncForUser(userId: string): Promise<void> {
    const accessToken = await this.googleService.getValidAccessToken(userId);

    const integration = await this.prisma.googleIntegration.findUnique({
      where: { userId },
      select: { syncToken: true },
    });

    const events = await this.fetchAllEvents(accessToken, integration?.syncToken ?? null, userId);

    for (const event of events.items) {
      if (!event.start) continue;
      await this.upsertMeeting(userId, event);
    }

    await this.prisma.googleIntegration.update({
      where: { userId },
      data: { syncToken: events.nextSyncToken ?? null, lastSyncedAt: new Date() },
    });
  }

  async getMeetings(userId: string, view: 'upcoming' | 'past' | 'all' = 'upcoming'): Promise<Meeting[]> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const where: Prisma.MeetingWhereInput = {
      userId,
      ...(view !== 'all' && { status: { not: 'cancelled' } }),
      ...(view === 'upcoming' && { startTime: { gte: startOfToday } }),
      ...(view === 'past' && { endTime: { lt: now } }),
    };

    return this.prisma.meeting.findMany({
      where,
      orderBy: { startTime: view === 'past' ? 'desc' : 'asc' },
    });
  }

  async getSyncStatus(userId: string): Promise<{ syncing: boolean; lastSyncedAt: Date | null }> {
    const integration = await this.prisma.googleIntegration.findUnique({
      where: { userId },
      select: { lastSyncedAt: true },
    });
    return { syncing: false, lastSyncedAt: integration?.lastSyncedAt ?? null };
  }

  private async fetchAllEvents(
    accessToken: string,
    syncToken: string | null,
    userId: string,
  ): Promise<{ items: GoogleCalendarEvent[]; nextSyncToken?: string }> {
    const items: GoogleCalendarEvent[] = [];
    let nextSyncToken: string | undefined;
    let pageToken: string | undefined;

    const buildParams = (pt?: string) => {
      if (syncToken) {
        return { syncToken, ...(pt && { pageToken: pt }) };
      }
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      return {
        singleEvents: true,
        orderBy: 'startTime',
        timeMin: startOfToday.toISOString(),
        maxResults: 250,
        ...(pt && { pageToken: pt }),
      };
    };

    do {
      try {
        const { data } = await axios.get<CalendarEventsResponse>(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events',
          { headers: { Authorization: `Bearer ${accessToken}` }, params: buildParams(pageToken) },
        );
        items.push(...(data.items ?? []));
        nextSyncToken = data.nextSyncToken;
        pageToken = data.nextPageToken;
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 410) {
          // syncToken stale — clear it and retry as full sync
          await this.prisma.googleIntegration.update({
            where: { userId },
            data: { syncToken: null },
          });
          return this.fetchAllEvents(accessToken, null, userId);
        }
        throw err;
      }
    } while (pageToken);

    return { items, nextSyncToken };
  }

  private async upsertMeeting(userId: string, event: GoogleCalendarEvent): Promise<void> {
    const title = event.summary ?? '(No title)';
    const startTime = this.parseEventDate(event.start);
    const endTime = this.parseEventDate(event.end) ?? startTime;
    const meetLink = this.extractMeetLink(event);
    const attendees = (event.attendees ?? []).map((a) => a.email);

    await this.prisma.meeting.upsert({
      where: { userId_googleEventId: { userId, googleEventId: event.id } },
      create: {
        userId,
        googleEventId: event.id,
        title,
        description: event.description ?? null,
        location: event.location ?? null,
        startTime,
        endTime,
        meetLink,
        attendees,
        htmlLink: event.htmlLink ?? null,
        status: event.status ?? 'confirmed',
      },
      update: {
        title,
        description: event.description ?? null,
        location: event.location ?? null,
        startTime,
        endTime,
        meetLink,
        attendees,
        htmlLink: event.htmlLink ?? null,
        status: event.status ?? 'confirmed',
      },
    });
  }

  private parseEventDate(
    dt?: { dateTime?: string; date?: string },
  ): Date {
    if (dt?.dateTime) return new Date(dt.dateTime);
    if (dt?.date) return new Date(`${dt.date}T00:00:00Z`);
    return new Date();
  }

  private extractMeetLink(event: GoogleCalendarEvent): string | null {
    const videoEntry = event.conferenceData?.entryPoints?.find(
      (e) => e.entryPointType === 'video',
    );
    if (videoEntry?.uri) return videoEntry.uri;

    for (const text of [event.description, event.location]) {
      if (!text) continue;
      const match = MEET_LINK_REGEX.exec(text);
      if (match) return match[0];
    }

    return null;
  }

  async inviteAssistant(userId: string, meetingId: string): Promise<Meeting> {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, userId },
    });

    if (!meeting) throw new NotFoundException('Meeting not found');
    if (meeting.status === 'cancelled') throw new BadRequestException('Cannot invite assistant to a cancelled meeting');
    if (meeting.endTime < new Date()) throw new BadRequestException('Cannot invite assistant to a meeting that has already ended');
    const activeStatuses = ['scheduled', 'joining', 'in_progress', 'processing'];
    if (activeStatuses.includes(meeting.assistantStatus)) {
      throw new ConflictException('Assistant is already active for this meeting');
    }

    return this.prisma.meeting.update({
      where: { id: meetingId },
      data: { assistantStatus: 'scheduled' },
    });
  }

  async cancelInvite(userId: string, meetingId: string): Promise<Meeting> {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, userId },
    });

    if (!meeting) throw new NotFoundException('Meeting not found');
    if (meeting.assistantStatus !== 'scheduled') throw new BadRequestException('Assistant is not invited to this meeting');

    return this.prisma.meeting.update({
      where: { id: meetingId },
      data: { assistantStatus: 'none' },
    });
  }

  logSyncError(userId: string, err: unknown): void {
    this.logger.warn(`Sync failed for user ${userId}: ${String(err)}`);
  }
}
