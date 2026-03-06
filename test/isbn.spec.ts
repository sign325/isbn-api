import { describe, it, expect } from 'vitest';
import { searchByIsbn } from '../src/parsers.js';

describe('searchByIsbn', () => {
	it('resolves a known ISBN to book info', async () => {
		const result = await searchByIsbn('9788384410363');
		expect(result).toEqual({ id: '5229057', slug: 'slady', title: 'Ślady' });
	}, 15000);

	it('returns null for an unknown ISBN', async () => {
		const result = await searchByIsbn('9999999999999');
		expect(result).toBeNull();
	}, 15000);
});
