import type { Browser } from 'patchright';
import type { BookstoreLink, EmpikData } from './types.js';
import { parseEmpikPage, randomHeaders } from './parsers.js';
import { cacheGet, cacheSet, MISS } from './cache.js';
import { parseProxyUrl } from './proxy.js';

const TTL_30_DAYS = 30 * 24 * 60 * 60;

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
	if (browser?.isConnected()) return browser;

	const { chromium } = await import('patchright');
	browser = await chromium.launch({ headless: true });
	return browser;
}

export async function closeBrowser(): Promise<void> {
	if (browser) {
		await browser.close();
		browser = null;
	}
}

/**
 * Find empik link in bookstores and resolve the final empik.com product URL.
 * The bookstore URL is a go.buybox.click redirect that leads through tradedoubler to empik.com.
 */
export async function resolveEmpikUrl(bookstores: BookstoreLink[]): Promise<string | null> {
	// Prefer book type empik offers, then any empik offer
	const empikBook = bookstores.find((b) => b.name.toLowerCase().includes('empik') && b.type === 'book');
	const empikAny = bookstores.find((b) => b.name.toLowerCase().includes('empik'));
	const empikLink = empikBook || empikAny;
	if (!empikLink) return null;

	try {
		// Follow redirect chain: go.buybox.click → tradedoubler → empik.com
		let url = empikLink.url;
		for (let i = 0; i < 5; i++) {
			const res = await fetch(url, {
				headers: randomHeaders(),
				redirect: 'manual',
			});
			const location = res.headers.get('location');
			if (!location) break;
			url = new URL(location, url).href;

			// Extract empik.com URL from tradedoubler redirect (url= parameter)
			if (url.includes('tradedoubler.com')) {
				const tdUrl = new URL(url);
				const empikUrl = tdUrl.searchParams.get('url');
				if (empikUrl) return empikUrl;
			}

			if (url.includes('empik.com')) return url.split('?')[0]; // strip tracking params
		}
		return url.includes('empik.com') ? url.split('?')[0] : null;
	} catch {
		return null;
	}
}

/**
 * Fetch and parse empik.com product page using Patchright.
 * Waits for Cloudflare challenge to resolve before extracting content.
 */
export async function fetchEmpikData(url: string): Promise<EmpikData | null> {
	try {
		const b = await getBrowser();
		const context = await b.newContext({
			proxy: parseProxyUrl(),
			userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
			viewport: { width: 1280, height: 800 },
			locale: 'pl-PL',
		});
		const page = await context.newPage();
		// Block images, fonts, CSS, media — we only need the HTML
		await page.route('**/*', (route) => {
			const type = route.request().resourceType();
			if (type === 'image' || type === 'font' || type === 'stylesheet' || type === 'media') {
				return route.abort();
			}
			return route.continue();
		});
		try {
			await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

			// Wait for Cloudflare challenge to resolve — poll for og:image or product content
			const resolved = await page.waitForFunction(
				() => {
					return (
						document.title !== 'Just a moment...' &&
						!document.title.includes('moment')
					);
				},
				{ timeout: 20000 },
			).then(() => true).catch(() => false);

			if (!resolved) return null;

			// Give the page a moment to finish rendering
			await page.waitForTimeout(1000);

			const html = await page.content();
			return parseEmpikPage(html);
		} finally {
			await page.close();
			await context.close();
		}
	} catch {
		return null;
	}
}

/**
 * Full enrichment pipeline: find empik link, resolve URL, fetch data.
 */
export async function enrichFromEmpik(bookstores: BookstoreLink[]): Promise<EmpikData | null> {
	const empikUrl = await resolveEmpikUrl(bookstores);
	if (!empikUrl) return null;

	const cacheKey = `empik:${empikUrl}`;
	const cached = await cacheGet<EmpikData | null>(cacheKey);
	if (cached !== MISS) return cached;

	const result = await fetchEmpikData(empikUrl);
	await cacheSet(cacheKey, result, TTL_30_DAYS);
	return result;
}
