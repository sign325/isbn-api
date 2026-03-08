import type { SkupszopData } from './types.js';
import { cacheGet, cacheSet, MISS } from './cache.js';

const TTL_30_DAYS = 30 * 24 * 60 * 60;

/**
 * Check if skupszop.pl has a cover image for the given ISBN.
 * Cover URLs are predictable: https://skupszop.pl/images/books/webp/{ISBN}.webp
 */
export async function fetchSkupszopCover(isbn: string): Promise<SkupszopData | null> {
	const cleanIsbn = isbn.replace(/[-\s]/g, '');
	if (!cleanIsbn) return null;

	const cacheKey = `skupszop:${cleanIsbn}`;
	const cached = await cacheGet<SkupszopData | null>(cacheKey);
	if (cached !== MISS) return cached;

	const url = `https://skupszop.pl/images/books/webp/${cleanIsbn}.webp`;
	console.log(`[skupszop] HEAD ${url}`);

	try {
		const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
		const contentType = res.headers.get('content-type') || '';
		const contentLength = res.headers.get('content-length');
		const isPlaceholder = contentLength === '13143' || !contentType.startsWith('image/webp');
		const isImage = res.ok && contentType.startsWith('image/') && !isPlaceholder;
		const result: SkupszopData = { coverUrl: isImage ? url : null };
		await cacheSet(cacheKey, result, TTL_30_DAYS);
		return result.coverUrl ? result : null;
	} catch {
		await cacheSet(cacheKey, { coverUrl: null }, TTL_30_DAYS);
		return null;
	}
}
