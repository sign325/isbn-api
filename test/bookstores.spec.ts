import { describe, it, expect } from 'vitest';
import { extractBuyboxUrl, fetchBookstores } from '../src/parsers.js';

describe('extractBuyboxUrl', () => {
	it('extracts buybox API URL from page HTML', () => {
		const html = `
			<script>
			document.addEventListener('DOMContentLoaded', function(){
				fetchBBOffers('https://buybox.click/17929/buybox.json?name=Dobry+omen&info[]=Terry+Pratchett&info[]=Neil+Gaiman&number[]=9788381690867&skip_jQuery=1&abpar1=web_desktop&widget_element_id=1&abpar2=4884797.0.&abpar3=book.details.main.list');
			});
			</script>
		`;
		const url = extractBuyboxUrl(html);
		expect(url).toBe(
			'https://buybox.click/17929/buybox.json?name=Dobry+omen&info[]=Terry+Pratchett&info[]=Neil+Gaiman&number[]=9788381690867&skip_jQuery=1&abpar1=web_desktop&widget_element_id=1&abpar2=4884797.0.&abpar3=book.details.main.list',
		);
	});

	it('returns null when no buybox URL found', () => {
		const html = '<html><body>No buybox here</body></html>';
		expect(extractBuyboxUrl(html)).toBeNull();
	});
});

describe('fetchBookstores', () => {
	it('fetches and parses buybox API response', async () => {
		// Use the real buybox API for Dobry Omen
		const url =
			'https://buybox.click/17929/buybox.json?name=Dobry+omen&info[]=Terry+Pratchett&info[]=Neil+Gaiman&number[]=9788381690867&number[]=978-83-7180-097-5&number[]=9788374692724&number[]=8385100636&skip_jQuery=1&abpar1=web_desktop&widget_element_id=1&abpar2=4884797.0.&abpar3=book.details.main.list';
		const bookstores = await fetchBookstores(url);

		expect(bookstores.length).toBeGreaterThan(0);

		// Each bookstore has required fields
		for (const store of bookstores) {
			expect(typeof store.name).toBe('string');
			expect(store.name.length).toBeGreaterThan(0);
			expect(typeof store.url).toBe('string');
			expect(store.url).toContain('buybox.click');
			expect(store.price === null || typeof store.price === 'number').toBe(true);
			expect(store.currency).toBe('PLN');
			expect(store.type === null || typeof store.type === 'string').toBe(true);
		}

		// Should have empik among the stores
		const empik = bookstores.find((s) => s.name.toLowerCase().includes('empik'));
		expect(empik).toBeDefined();
	});

	it('returns empty array for invalid URL', async () => {
		const result = await fetchBookstores('https://buybox.click/invalid/404');
		expect(result).toEqual([]);
	});
});
