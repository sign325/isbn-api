import { Redis } from 'ioredis';

export const MISS = Symbol('cache-miss');

const CACHE_PREFIXES = ['author:', 'isbn:', 'empik:', 'publisher:'];

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
	lazyConnect: true,
	maxRetriesPerRequest: 1,
	retryStrategy(times: number) {
		if (times > 2) return null;
		return Math.min(times * 200, 1000);
	},
});

let connected = false;

async function ensureConnected(): Promise<boolean> {
	if (connected) return true;
	try {
		await redis.connect();
		connected = true;
		return true;
	} catch {
		return false;
	}
}

export async function cacheGet<T>(key: string): Promise<T | typeof MISS> {
	try {
		if (!await ensureConnected()) return MISS;
		const raw = await redis.get(key);
		if (raw === null) return MISS;
		console.log(`[cache] HIT ${key}`);
		return JSON.parse(raw) as T;
	} catch {
		return MISS;
	}
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
	try {
		if (!await ensureConnected()) return;
		console.log(`[cache] SET ${key}`);
		redis.set(key, JSON.stringify(value), 'EX', ttlSeconds).catch(() => {});
	} catch {
		// fire-and-forget
	}
}

/** Flush all keys with our prefixes. Called on dev startup. */
export async function cacheFlush(): Promise<void> {
	try {
		if (!await ensureConnected()) return;
		for (const prefix of CACHE_PREFIXES) {
			const keys = await redis.keys(`${prefix}*`);
			if (keys.length > 0) {
				await redis.del(...keys);
				console.log(`[cache] FLUSH ${keys.length} keys with prefix "${prefix}"`);
			}
		}
	} catch {
		// ignore
	}
}
