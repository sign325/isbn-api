import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseAuthor } from '../src/parsers.js';

const gaimanHtml = readFileSync(join(__dirname, 'fixtures/author-14260-neil-gaiman.html'), 'utf-8');
const pratchettHtml = readFileSync(join(__dirname, 'fixtures/author-3221-terry-pratchett.html'), 'utf-8');

describe('parseAuthor - Neil Gaiman (14260)', () => {
	const author = parseAuthor(gaimanHtml, '14260', 'https://lubimyczytac.pl/autor/14260/neil-gaiman');

	it('has correct id, name, url', () => {
		expect(author.id).toBe('14260');
		expect(author.name).toBe('Neil Gaiman');
		expect(author.url).toBe('https://lubimyczytac.pl/autor/14260/neil-gaiman');
	});

	it('has photo url (352x500)', () => {
		expect(author.photoUrl).toContain('352x500');
		expect(author.photoUrl).toContain('lubimyczytac.pl');
	});

	it('has birth date', () => {
		expect(author.birthDate).toBe('10.11.1960');
	});

	it('has no death date (alive)', () => {
		expect(author.deathDate).toBeNull();
	});

	it('has description', () => {
		expect(author.description).toBeTruthy();
		expect(author.description!.length).toBeGreaterThan(50);
	});

	it('has website', () => {
		expect(author.website).toBe('http://www.neilgaiman.com/');
	});

	it('has books count', () => {
		expect(author.booksCount).toBe(183);
	});

	it('has rating', () => {
		expect(author.rating).toBe(6.7);
	});

	it('has genres', () => {
		expect(author.genres.length).toBeGreaterThan(0);
		expect(author.genres).toContain('fantasy, science fiction');
	});

	it('has readers and wantToRead counts', () => {
		expect(author.readersCount).toBeGreaterThan(0);
		expect(author.wantToReadCount).toBeGreaterThan(0);
	});

	it('has fans count', () => {
		expect(author.fansCount).toBeGreaterThan(0);
	});

	it('has most popular book', () => {
		expect(author.mostPopularBook).not.toBeNull();
		expect(author.mostPopularBook!.title).toBe('Amerykańscy bogowie');
		expect(author.mostPopularBook!.id).toBe('3868566');
		expect(author.mostPopularBook!.url).toContain('lubimyczytac.pl/ksiazka/3868566');
		expect(author.mostPopularBook!.coverUrl).toBeTruthy();
		expect(author.mostPopularBook!.rating).toBe(7.3);
		expect(author.mostPopularBook!.ratingsCount).toBe(10294);
		expect(author.mostPopularBook!.readersCount).toBe(22289);
		expect(author.mostPopularBook!.reviewsCount).toBe(854);
	});
});

describe('parseAuthor - Terry Pratchett (3221)', () => {
	const author = parseAuthor(pratchettHtml, '3221', 'https://lubimyczytac.pl/autor/3221/terry-pratchett');

	it('has correct name', () => {
		expect(author.name).toBe('Terry Pratchett');
	});

	it('has birth and death dates', () => {
		expect(author.birthDate).toBe('28.04.1948');
		expect(author.deathDate).toBe('12.03.2015');
	});

	it('has website', () => {
		expect(author.website).toBe('http://www.terrypratchettbooks.com/');
	});

	it('has fans count', () => {
		expect(author.fansCount).toBeGreaterThan(0);
	});

	it('has most popular book', () => {
		expect(author.mostPopularBook).not.toBeNull();
		expect(author.mostPopularBook!.id).toBeTruthy();
		expect(author.mostPopularBook!.title).toBeTruthy();
	});
});
