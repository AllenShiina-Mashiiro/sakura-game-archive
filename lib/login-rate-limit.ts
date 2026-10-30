
import { Redis } from '@upstash/redis';
import { createHash } from 'node:crypto';

const WINDOW_SECONDS = 15 * 60;
const MAX_FAILED_ATTEMPTS = 10;

let redis: Redis | null = null;

function getRedis() {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error('缺少 Upstash Redis 环境变量');
  }

  redis = new Redis({ url, token });
  return redis;
}

function getKey(ip: string) {
  const hash = createHash('sha256').update(ip).digest('hex');
  return `login:failed:${hash}`;
}

export async function isLoginBlocked(ip: string) {
  const count = Number(
    (await getRedis().get(getKey(ip))) ?? 0
  );

  return count >= MAX_FAILED_ATTEMPTS;
}

export async function recordLoginFailure(ip: string) {
    const key = getKey(ip);

  const result = await getRedis().eval(
    `
      local count = redis.call('INCR', KEYS[1])
      if count == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
      end
      return count
    `,
    [key],
    [WINDOW_SECONDS]
  );

  return Number(result);
}


export async function clearLoginFailures(ip: string) {
  await getRedis().del(getKey(ip));
}

