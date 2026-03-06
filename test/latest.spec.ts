import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const fixturesDir = join(__dirname, 'fixtures/latest');
const files = readdirSync(fixturesDir).filter(f => f.endsWith('.json'));
const books = files.map(f => JSON.parse(readFileSync(join(fixturesDir, f), 'utf-8')));

describe('latest 20 books - structure validation', () => {
	it('loaded 20 fixtures', () => {
		expect(books).toHaveLength(20);
	});

	for (const book of books) {
		describe(`${book.title} (${book.id})`, () => {
			it('has required string fields', () => {
				expect(typeof book.id).toBe('string');
				expect(book.id).toMatch(/^\d+$/);
				expect(typeof book.title).toBe('string');
				expect(book.title.length).toBeGreaterThan(0);
				expect(typeof book.url).toBe('string');
				expect(book.url).toContain('lubimyczytac.pl/ksiazka/');
			});

			it('has authors array with at least one author', () => {
				expect(Array.isArray(book.authors)).toBe(true);
				expect(book.authors.length).toBeGreaterThan(0);
				for (const a of book.authors) {
					expect(typeof a.id).toBe('string');
					expect(a.id).toMatch(/^\d+$/);
					expect(typeof a.name).toBe('string');
					expect(a.name.length).toBeGreaterThan(0);
				}
			});

			it('has publisher with id and name', () => {
				expect(book.publisher).not.toBeNull();
				expect(typeof book.publisher.id).toBe('string');
				expect(book.publisher.id).toMatch(/^\d+$/);
				expect(typeof book.publisher.name).toBe('string');
			});

			it('has categories array', () => {
				expect(Array.isArray(book.categories)).toBe(true);
				expect(book.categories.length).toBeGreaterThan(0);
				for (const c of book.categories) {
					expect(typeof c.slug).toBe('string');
					expect(typeof c.name).toBe('string');
				}
			});

			it('has coverUrl', () => {
				expect(typeof book.coverUrl).toBe('string');
				expect(book.coverUrl).toContain('lubimyczytac.pl');
			});

			it('has descriptions array', () => {
				expect(Array.isArray(book.descriptions)).toBe(true);
				for (const d of book.descriptions) {
					expect(typeof d.source).toBe('string');
					expect(typeof d.text).toBe('string');
				}
			});

			it('has rating as number or null', () => {
				expect(book.rating === null || typeof book.rating === 'number').toBe(true);
			});

			it('has pages as number or null', () => {
				expect(book.pages === null || typeof book.pages === 'number').toBe(true);
			});

			it('has translators array', () => {
				expect(Array.isArray(book.translators)).toBe(true);
			});

			it('has otherEditions array', () => {
				expect(Array.isArray(book.otherEditions)).toBe(true);
				for (const ed of book.otherEditions) {
					expect(typeof ed.id).toBe('string');
					expect(ed.id).toMatch(/^\d+$/);
					expect(typeof ed.url).toBe('string');
					// enriched editions have extra fields
					expect(typeof ed.title).toBe('string');
					expect(ed.publisher === null || typeof ed.publisher === 'object').toBe(true);
				}
			});

			it('has series as object or null', () => {
				if (book.series) {
					expect(typeof book.series.id).toBe('string');
					expect(typeof book.series.name).toBe('string');
					expect(book.series.volume === null || typeof book.series.volume === 'number').toBe(true);
				} else {
					expect(book.series).toBeNull();
				}
			});

			it('has publishingSeries as object or null', () => {
				if (book.publishingSeries) {
					expect(typeof book.publishingSeries.id).toBe('string');
					expect(typeof book.publishingSeries.name).toBe('string');
				} else {
					expect(book.publishingSeries).toBeNull();
				}
			});

			it('has date fields as string or null', () => {
				for (const field of ['publishDate', 'firstLocalPublishDate', 'firstPublishDate']) {
					expect(book[field] === null || typeof book[field] === 'string').toBe(true);
				}
			});

			it('has no HTML entities in text fields', () => {
				const textFields = [book.title, ...book.descriptions.map((d: any) => d.text), book.originalTitle, ...book.authors.map((a: any) => a.name)];
				for (const val of textFields) {
					if (val) {
						expect(val).not.toMatch(/&[a-z]+;/);
						expect(val).not.toMatch(/&#\d+;/);
					}
				}
			});
		});
	}
});
