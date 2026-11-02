import type { Friendship } from './types';

type FriendRequestAction = 'accept' | 'reject' | 'ignore';
type FriendRequestDecision =
  | { error: string }
  | { kind: 'ignore'; message: string }
  | { kind: 'update'; status: 'accepted' | 'rejected'; message: string };

export function decideFriendRequestAction(args: {
  action: string;
  relation: Friendship | undefined;
  userId: string;
}): FriendRequestDecision;

export function isUnreadFriendRequestNotification(
  notification: { userId: string; actorId?: string; title: string; readAt?: string },
  userId: string,
  actorId: string,
): boolean;
