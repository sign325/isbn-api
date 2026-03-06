import { describe, it, expect } from 'vitest';
import slady from './fixtures/5229057-slady.json';
import barbra from './fixtures/5224317-na-imie-mam-barbra.json';
import dobryOmen from './fixtures/4884797-dobry-omen.json';
import harryPotter from './fixtures/5228289-harry-potter-i-komnata-tajemnic.json';
import przewieszenie from './fixtures/273271-przewieszenie.json';
import korowod from './fixtures/5114878-korowod.json';

describe('Ślady (5229057) - polski oryginał, 1 autor, brak tłumacza', () => {
	const book = slady;

	it('has correct id and url', () => {
		expect(book.id).toBe('5229057');
		expect(book.url).toContain('lubimyczytac.pl/ksiazka/5229057');
	});

	it('has single author', () => {
		expect(book.authors).toHaveLength(1);
		expect(book.authors[0]).toEqual({ id: '216354', name: 'Paulina Cedlerska', url: 'https://lubimyczytac.pl/autor/216354/paulina-cedlerska' });
	});

	it('has no translators', () => {
		expect(book.translators).toHaveLength(0);
	});

	it('has no originalTitle or firstPublishDate', () => {
		expect(book.originalTitle).toBeNull();
		expect(book.firstPublishDate).toBeNull();
	});

	it('has publisher with id', () => {
		expect(book.publisher).toEqual({ id: '2918', name: 'Filia' });
	});

	it('has category with id', () => {
		expect(book.categories).toHaveLength(1);
		expect(book.categories[0].id).toBe('53');
		expect(book.categories[0].slug).toBe('beletrystyka/kryminal-sensacja-thriller');
	});

	it('has pages and isbn', () => {
		expect(book.pages).toBe(366);
		expect(book.isbn).toBe('9788384410363');
	});
});

describe('Na imię mam Barbra (5224317) - tłumaczenie, 1 autor, 1 tłumacz', () => {
	const book = barbra;

	it('has single author', () => {
		expect(book.authors).toHaveLength(1);
		expect(book.authors[0]).toEqual({ id: '257408', name: 'Barbra Streisand', url: 'https://lubimyczytac.pl/autor/257408/barbra-streisand' });
	});

	it('has single translator with id', () => {
		expect(book.translators).toHaveLength(1);
		expect(book.translators[0]).toEqual({ id: '14308', name: 'Katarzyna Bażyńska-Chojnacka' });
	});

	it('has originalTitle and firstPublishDate', () => {
		expect(book.originalTitle).toBe('My Name Is Barbra');
		expect(book.firstPublishDate).toBe('2023-11-07');
	});

	it('has all three dates', () => {
		expect(book.publishDate).toBe('2026-02-25');
		expect(book.firstLocalPublishDate).toBe('2026-02-25');
		expect(book.firstPublishDate).toBe('2023-11-07');
	});
});

describe('Dobry omen (4884797) - 2 autorów, 2 tłumaczy', () => {
	const book = dobryOmen;

	it('has two authors', () => {
		expect(book.authors).toHaveLength(2);
		expect(book.authors[0]).toEqual({ id: '14260', name: 'Neil Gaiman', url: 'https://lubimyczytac.pl/autor/14260/neil-gaiman' });
		expect(book.authors[1]).toEqual({ id: '3221', name: 'Terry Pratchett', url: 'https://lubimyczytac.pl/autor/3221/terry-pratchett' });
	});

	it('has two translators', () => {
		expect(book.translators).toHaveLength(2);
		expect(book.translators[0]).toEqual({ id: '11691', name: 'Juliusz Wilczur-Garztecki' });
		expect(book.translators[1]).toEqual({ id: '12026', name: 'Jacek Gałązka' });
	});

	it('has originalTitle and all dates', () => {
		expect(book.originalTitle).toBe('Good Omens');
		expect(book.publishDate).toBe('2019-05-16');
		expect(book.firstLocalPublishDate).toBe('1992-01-01');
		expect(book.firstPublishDate).toBe('1990-05-01');
	});

	it('has series null (no series)', () => {
		expect(book.series).toBeNull();
	});
});

describe('Harry Potter i Komnata Tajemnic (5228289) - cykl z tomem', () => {
	const book = harryPotter;

	it('has series with id, name and volume', () => {
		expect(book.series).toEqual({ id: '143', name: 'Harry Potter', volume: 2 });
	});

	it('has single author', () => {
		expect(book.authors).toHaveLength(1);
		expect(book.authors[0]).toEqual({ id: '3701', name: 'J.K. Rowling', url: 'https://lubimyczytac.pl/autor/3701/jk-rowling' });
	});

	it('has single translator', () => {
		expect(book.translators).toHaveLength(1);
		expect(book.translators[0]).toEqual({ id: '10415', name: 'Andrzej Polkowski' });
	});

	it('has all three dates', () => {
		expect(book.publishDate).toBe('2026-03-25');
		expect(book.firstLocalPublishDate).toBe('2000-01-01');
		expect(book.firstPublishDate).toBe('1998-01-01');
	});

	it('has no publishingSeries', () => {
		expect(book.publishingSeries).toBeNull();
	});
});

describe('Przewieszenie (273271) - cykl + seria wydawnicza', () => {
	const book = przewieszenie;

	it('has series (cykl)', () => {
		expect(book.series).toEqual({ id: '17775', name: 'Komisarz Forst', volume: 2 });
	});

	it('has publishingSeries (seria wydawnicza)', () => {
		expect(book.publishingSeries).toEqual({ id: '9663', name: 'Mroczna strona' });
	});

	it('has no publishingSeries on books without it', () => {
		expect(slady.publishingSeries).toBeNull();
		expect(dobryOmen.publishingSeries).toBeNull();
	});
});

describe('Inne wydania (other editions)', () => {
	it('has enriched other editions for Dobry Omen', () => {
		expect(dobryOmen.otherEditions.length).toBeGreaterThan(0);
		const ed = dobryOmen.otherEditions[0];
		expect(ed).toHaveProperty('id');
		expect(ed).toHaveProperty('url');
		expect(ed).toHaveProperty('title');
		expect(ed).toHaveProperty('publisher');
		expect(ed).toHaveProperty('format');
		expect(ed).toHaveProperty('isbn');
	});

	it('has other editions for Harry Potter', () => {
		expect(harryPotter.otherEditions.length).toBeGreaterThan(0);
		expect(harryPotter.otherEditions[0]).toHaveProperty('title');
	});

	it('has empty otherEditions for single-edition books', () => {
		expect(slady.otherEditions).toEqual([]);
	});
});

describe('Korowód (5114878) - HTML entity decoding', () => {
	const book = korowod;

	it('decodes HTML entities in title', () => {
		expect(book.title).toBe('Korowód');
	});

	it('has correct basic data', () => {
		expect(book.id).toBe('5114878');
		expect(book.authors[0].name).toBe('Jakub Małecki');
		expect(book.publisher?.name).toBe('Sine Qua Non');
	});
});
