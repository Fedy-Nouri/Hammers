export interface EmailContent {
  subject: string;
  html: string;
}

function wrap(title: string, bodyHtml: string): string {
  return `<div style="font-family:system-ui,-apple-system,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin:0 0 16px;font-size:18px">${title}</h2>
  ${bodyHtml}
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="font-size:12px;color:#888">Hammers — your AI agents platform</p>
</div>`;
}

const button = (href: string, label: string): string =>
  `<a href="${href}" style="display:inline-block;background:#6d28d9;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px">${label}</a>`;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function passwordResetEmail(link: string): EmailContent {
  return {
    subject: 'Reset your Hammers password',
    html: wrap('Reset your password', `
    <p>We received a request to reset your password. This link expires in 1 hour.</p>
    <p>${button(link, 'Reset password')}</p>
    <p style="font-size:12px;color:#888">If you didn't request this, you can safely ignore this email.</p>`),
  };
}

export function welcomeEmail(firstName?: string | null): EmailContent {
  const name = firstName ? ` ${escapeHtml(firstName)}` : '';
  return {
    subject: 'Welcome to Hammers',
    html: wrap(`Welcome${name}!`, `
    <p>Your account is ready. Head to the marketplace and launch your first AI agent — a meeting copilot, a job hunter, or a data analyst.</p>`),
  };
}

export function quotaWarnEmail(usedUsd: number, cap: number, percent: number): EmailContent {
  return {
    subject: `You've used ${percent}% of your monthly AI limit`,
    html: wrap('Approaching your usage limit', `
    <p>You've used <strong>$${usedUsd.toFixed(2)}</strong> of your <strong>$${cap.toFixed(2)}</strong> monthly AI allowance (${percent}%).</p>
    <p>Upgrade your plan from your profile to avoid interruptions.</p>`),
  };
}

export function quotaBlockedEmail(cap: number): EmailContent {
  return {
    subject: 'Monthly AI limit reached',
    html: wrap('Usage limit reached', `
    <p>You've reached your <strong>$${cap.toFixed(2)}</strong> monthly AI limit, so new AI requests are paused until your plan renews or you upgrade.</p>`),
  };
}

export function meetingFollowUpEmail(subject: string, body: string): EmailContent {
  const safeBody = escapeHtml(body).replace(/\n/g, '<br/>');
  return { subject, html: wrap(escapeHtml(subject), `<div>${safeBody}</div>`) };
}
