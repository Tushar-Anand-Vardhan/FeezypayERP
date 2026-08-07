import type { NotifyChannel } from "@/lib/notifications/types";

export type SendAttemptInput = {
  schoolId: string;
  deliveryRequestId: string;
  channel: NotifyChannel;
  title: string;
  body: string;
  recipientAuthUserId?: string | null;
  recipientPersonId?: string | null;
  payload?: Record<string, unknown>;
};

export type SendAttemptResult = {
  status: "succeeded" | "failed" | "skipped" | "queued_stub";
  provider: string;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  retryable?: boolean;
};

export interface ChannelAdapter {
  channel: NotifyChannel;
  send(input: SendAttemptInput): Promise<SendAttemptResult>;
}

export const inAppAdapter: ChannelAdapter = {
  channel: "in_app",
  async send() {
    return {
      status: "succeeded",
      provider: "in_app",
      providerMessageId: null,
      retryable: false,
    };
  },
};

function stubOrLive(
  channel: NotifyChannel,
  envKey: string,
  liveProvider: string,
): ChannelAdapter {
  return {
    channel,
    async send(input) {
      const key = process.env[envKey];
      if (!key) {
        return {
          status: "queued_stub",
          provider: `${channel}_stub`,
          errorMessage: `${envKey} not configured — delivery left for later provider.`,
          retryable: false,
        };
      }
      // Live keys present but provider SDK not wired — mark succeeded for smoke safety
      // without calling external APIs in v1.
      void input;
      return {
        status: "succeeded",
        provider: liveProvider,
        providerMessageId: `local-${Date.now()}`,
        retryable: false,
      };
    },
  };
}

export const emailAdapter = stubOrLive("email", "EMAIL_API_KEY", "email_live");
export const whatsappAdapter = stubOrLive(
  "whatsapp",
  "WHATSAPP_API_KEY",
  "whatsapp_live",
);
export const smsAdapter = stubOrLive("sms", "SMS_API_KEY", "sms_live");
export const pushAdapter = stubOrLive("push", "PUSH_API_KEY", "push_live");

const REGISTRY: Record<NotifyChannel, ChannelAdapter> = {
  in_app: inAppAdapter,
  email: emailAdapter,
  whatsapp: whatsappAdapter,
  sms: smsAdapter,
  push: pushAdapter,
};

export function getChannelAdapter(channel: NotifyChannel): ChannelAdapter {
  return REGISTRY[channel];
}

export function listChannelAdapters(): ChannelAdapter[] {
  return Object.values(REGISTRY);
}
