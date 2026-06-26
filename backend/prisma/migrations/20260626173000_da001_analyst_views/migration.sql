-- DA-001: per-user, read-only views for the Data Analyst agent.
--
-- Each view exposes only the calling user's rows by filtering on the
-- `app.current_user_id` GUC, which SqlExecutorService sets (via set_config) at the
-- start of every read-only transaction. `current_setting('app.current_user_id', true)`
-- uses missing_ok=true, so when the GUC is unset it returns NULL and the views match
-- zero rows — a safe default. `security_barrier` prevents a user-supplied predicate
-- from being evaluated before the row-level user filter.
--
-- These views are intentionally NOT modelled in schema.prisma; Prisma does not manage
-- views without the `views` preview feature, so they live only in the database and do
-- not interfere with drift detection. Sensitive/bulky columns (resume text/url, raw
-- descriptions, cover letters, JSON blobs) are deliberately omitted.

-- Direct userId scope ---------------------------------------------------------

CREATE VIEW analyst_job_applications WITH (security_barrier = true) AS
SELECT id, source, url, title, company, location, "matchScore", "matchSummary",
       status, notes, "appliedAt", "createdAt", "updatedAt"
FROM job_applications
WHERE "userId" = current_setting('app.current_user_id', true);

CREATE VIEW analyst_job_profiles WITH (security_barrier = true) AS
SELECT id, "desiredTitles", locations, "remotePref", "salaryMin", keywords,
       "createdAt", "updatedAt"
FROM job_profiles
WHERE "userId" = current_setting('app.current_user_id', true);

CREATE VIEW analyst_job_scrape_jobs WITH (security_barrier = true) AS
SELECT id, status, requested, found, attempts, "lastError", "startedAt", "finishedAt",
       "createdAt", "updatedAt"
FROM job_scrape_jobs
WHERE "userId" = current_setting('app.current_user_id', true);

CREATE VIEW analyst_meetings WITH (security_barrier = true) AS
SELECT id, title, location, "startTime", "endTime", status, "assistantStatus",
       "createdAt", "updatedAt"
FROM meetings
WHERE "userId" = current_setting('app.current_user_id', true);

CREATE VIEW analyst_conversations WITH (security_barrier = true) AS
SELECT id, "agentId", title, "createdAt", "updatedAt"
FROM conversations
WHERE "userId" = current_setting('app.current_user_id', true);

CREATE VIEW analyst_ai_usage_logs WITH (security_barrier = true) AS
SELECT id, "agentId", "conversationId", provider, model, "promptTokens",
       "completionTokens", "totalTokens", "costUsd", "createdAt"
FROM ai_usage_logs
WHERE "userId" = current_setting('app.current_user_id', true);

-- JOIN scope (base table has no userId column) --------------------------------

CREATE VIEW analyst_meeting_reports WITH (security_barrier = true) AS
SELECT r.id, r."meetingId", r.executive, r.status, r."createdAt", r."updatedAt"
FROM meeting_reports r
JOIN meetings m ON m.id = r."meetingId"
WHERE m."userId" = current_setting('app.current_user_id', true);

CREATE VIEW analyst_messages WITH (security_barrier = true) AS
SELECT msg.id, msg."conversationId", msg.role, msg.content, msg."createdAt"
FROM messages msg
JOIN conversations c ON c.id = msg."conversationId"
WHERE c."userId" = current_setting('app.current_user_id', true);
