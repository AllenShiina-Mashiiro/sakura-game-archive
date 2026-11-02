export function normalizeDirectMessageContent(value: unknown): {
  content: string;
  error: string | null;
};

export function hasUnreadDirectMessageActivity(args: {
  messages: Array<{ fromId: string; toId: string; readAt?: string }>;
  notifications: Array<{ userId: string; type: string; actorId?: string; readAt?: string }>;
  userId: string;
  peerId: string;
}): boolean;
