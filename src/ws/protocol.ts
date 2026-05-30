import { z } from "zod";

// === Vivarium → Hub ===

const EventSchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal("text"), content: z.string() }),
  z.object({ event: z.literal("screenshot"), image: z.string() }),
  z.object({ event: z.literal("done"), cost: z.number().optional(), inputTokens: z.number().optional() }),
  z.object({ event: z.literal("error"), message: z.string() }),
  z.object({ event: z.literal("typing") }),
]);

const EventMessage = z
  .object({ type: z.literal("event"), msgId: z.string() })
  .and(EventSchema);

const RegisterMessage = z.object({
  type: z.literal("register"),
  token: z.string(),
  name: z.string(),
  version: z.string(),
});

const StatusMessage = z.object({
  type: z.literal("status"),
  appRunning: z.boolean(),
  uptime: z.number(),
  totalCostUsd: z.number().optional(),
  inputTokens: z.number().optional(),
});

export const VivariumMessageSchema = z.union([
  RegisterMessage,
  EventMessage,
  StatusMessage,
]);

export type VivariumMessage = z.infer<typeof VivariumMessageSchema>;

// === Hub → Vivarium ===

export const HubMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("registered"), vivariumId: z.string() }),
  z.object({ type: z.literal("message"), id: z.string(), text: z.string() }),
  z.object({ type: z.literal("wake"), reason: z.string() }),
  z.object({ type: z.literal("health_check") }),
  z.object({ type: z.literal("shutdown") }),
]);

export type HubMessage = z.infer<typeof HubMessageSchema>;
