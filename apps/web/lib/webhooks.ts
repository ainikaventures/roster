import { createHmac, randomBytes } from 'node:crypto';
import { prisma } from '@roster/db';

// ---------------------------------------------------------------------------
// Webhook delivery.
//
// `emitWebhookEvent` fans out a single event to every active webhook in an
// org that subscribes to it. Each delivery is recorded in WebhookDelivery
// with the response code and body. Retries are best-effort within the
// request lifetime; Phase 8 wires this to BullMQ for proper retries.
//
// The signature header `X-Roster-Signature: t=<unix>,v1=<hmac-sha256>`
// follows the Stripe pattern so consumers can copy-paste verification code.
// ---------------------------------------------------------------------------

export function newWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString('base64url')}`;
}

export type WebhookEvent =
  | 'shift.created'
  | 'shift.updated'
  | 'shift.published'
  | 'time_entry.created'
  | 'time_entry.approved'
  | 'task.completed'
  | 'form.submitted'
  | 'time_off.requested'
  | 'time_off.approved'
  | 'announcement.posted';

export type WebhookPayload = {
  id: string;
  type: WebhookEvent;
  orgId: string;
  createdAt: string;
  data: Record<string, unknown>;
};

function sign(secret: string, body: string, timestamp: number): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export async function emitWebhookEvent(
  orgId: string,
  type: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  const webhooks = await prisma.webhook.findMany({
    where: { orgId, isActive: true },
    select: { id: true, url: true, secret: true, events: true },
  });
  if (webhooks.length === 0) return;

  const subscribed = webhooks.filter((w) => {
    const events = Array.isArray(w.events) ? (w.events as string[]) : [];
    return events.length === 0 || events.includes(type);
  });
  if (subscribed.length === 0) return;

  const payload: WebhookPayload = {
    id: `evt_${randomBytes(8).toString('hex')}`,
    type,
    orgId,
    createdAt: new Date().toISOString(),
    data,
  };
  const body = JSON.stringify(payload);

  // Fire-and-forget; we don't await in the caller's hot path beyond the
  // initial dispatch. Each delivery gets one attempt now; Phase 8 will queue
  // retries via BullMQ.
  await Promise.all(
    subscribed.map(async (w) => {
      const ts = Math.floor(Date.now() / 1000);
      const signature = sign(w.secret, body, ts);
      const delivery = await prisma.webhookDelivery.create({
        data: {
          orgId,
          webhookId: w.id,
          event: type,
          payload: payload as never,
          status: 'PENDING',
        },
      });
      let statusCode: number | null = null;
      let responseBody: string | null = null;
      let errorMessage: string | null = null;

      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(w.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Roster-Webhooks/1.0',
            'X-Roster-Event': type,
            'X-Roster-Signature': `t=${ts},v1=${signature}`,
          },
          body,
          signal: controller.signal,
        });
        clearTimeout(t);
        statusCode = res.status;
        // Read at most 4KB of response body for the audit trail.
        responseBody = (await res.text()).slice(0, 4096);
      } catch (e) {
        errorMessage = e instanceof Error ? e.message : 'Unknown error';
      }

      const success =
        statusCode != null && statusCode >= 200 && statusCode < 300;
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: success ? 'SUCCESS' : 'FAILED',
          statusCode: statusCode ?? undefined,
          responseBody: responseBody ?? undefined,
          errorMessage: errorMessage ?? undefined,
          attemptCount: 1,
          attemptedAt: new Date(),
        },
      });
    }),
  );
}
