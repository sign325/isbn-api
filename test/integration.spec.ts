import { describe, it, expect, afterAll } from 'vitest';
import { resolveEmpikUrl, fetchEmpikData, closeBrowser } from '../src/empik.js';
import { extractBuyboxUrl, fetchBookstores, parseBook, randomHeaders } from '../src/parsers.js';

afterAll(async () => {
	await closeBrowser();
});

describe('integration: book endpoint pipeline', () => {
	let html: string;
	let bookstores: Awaited<ReturnType<typeof fetchBookstores>>;

	it('fetches a book page from lubimyczytac.pl', async () => {
		const res = await fetch('https://lubimyczytac.pl/ksiazka/4884797/dobry-omen', {
			headers: randomHeaders(),
			redirect: 'follow',
		});
		expect(res.ok).toBe(true);
		html = await res.text();
		expect(html.length).toBeGreaterThan(1000);
	}, 15000);

	it('parses the book correctly', () => {
		const book = parseBook(html, '4884797');
		expect(book.title).toBe('Dobry omen');
		expect(book.authors).toHaveLength(2);
		expect(book.bookstores).toEqual([]); // bookstores are fetched separately
		expect(book.coverUrlOriginal).toContain('lubimyczytac.pl');
	});

	it('extracts buybox URL from page HTML', () => {
		const buyboxUrl = extractBuyboxUrl(html);
		expect(buyboxUrl).not.toBeNull();
		expect(buyboxUrl).toContain('buybox.click');
		expect(buyboxUrl).toContain('4884797');
	});

	it('fetches bookstores from buybox API', async () => {
		const buyboxUrl = extractBuyboxUrl(html)!;
		bookstores = await fetchBookstores(buyboxUrl);
		expect(bookstores.length).toBeGreaterThan(5);

		const empik = bookstores.find((s) => s.name.toLowerCase().includes('empik'));
		expect(empik).toBeDefined();
		expect(empik!.url).toContain('buybox.click');
	}, 10000);

	it('resolves empik URL through redirect chain', async () => {
		const empikUrl = await resolveEmpikUrl(bookstores);
		expect(empikUrl).not.toBeNull();
		expect(empikUrl).toContain('empik.com');
		console.log('Resolved empik URL:', empikUrl);
	}, 15000);

	it('fetches empik page with Playwright and extracts data', async () => {
		const empikUrl = await resolveEmpikUrl(bookstores);
		if (!empikUrl) {
			console.log('Skipping: no empik URL resolved');
			return;
		}

		const data = await fetchEmpikData(empikUrl);
		console.log('Empik data:', JSON.stringify(data, null, 2));

		expect(data).not.toBeNull();
		// Cover should be from ecsmedia.pl (empik's CDN)
		if (data!.coverUrl) {
			expect(data!.coverUrl).toContain('ecsmedia.pl');
		}
	}, 30000);
});
