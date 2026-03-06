import type { Author, AuthorDetails, BookstoreLink, Category, CatalogBook, Dimensions, EmpikData, PublisherDetails, Translator } from './types.js';
import { cacheGet, cacheSet, MISS } from './cache.js';

const TTL_30_DAYS = 30 * 24 * 60 * 60;

export const SORT_OPTIONS = ['last-added-desc', 'last-added-asc', 'published-desc', 'published-asc', 'ratings-desc', 'ratings-asc'] as const;

export const USER_AGENTS = [
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0',
	'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
];

export function randomHeaders(): Record<string, string> {
	const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
	const isFirefox = ua.includes('Firefox');
	const isSafari = ua.includes('Safari') && !ua.includes('Chrome');

	return {
		'User-Agent': ua,
		'Accept': isFirefox
			? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
			: isSafari
				? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
				: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
		'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
		'Accept-Encoding': 'gzip, deflate, br',
		'Cache-Control': 'no-cache',
		'Sec-Fetch-Dest': 'document',
		'Sec-Fetch-Mode': 'navigate',
		'Sec-Fetch-Site': 'none',
		'Sec-Fetch-User': '?1',
		'Upgrade-Insecure-Requests': '1',
	};
}

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// Common HTML named entities → unicode codepoints
export const NAMED_ENTITIES: Record<string, number> = {
	amp: 38, lt: 60, gt: 62, quot: 34, apos: 39, nbsp: 160,
	ndash: 8211, mdash: 8212, laquo: 171, raquo: 187, hellip: 8230,
	copy: 169, reg: 174, trade: 8482, shy: 173, middot: 183, bull: 8226,
	// Polish/Latin diacritics that appear as entities
	oacute: 243, Oacute: 211, eacute: 233, Eacute: 201,
	agrave: 224, aacute: 225, acirc: 226, atilde: 227, auml: 228,
	egrave: 232, ecirc: 234, euml: 235,
	igrave: 236, iacute: 237, icirc: 238, iuml: 239,
	ograve: 242, ocirc: 244, otilde: 245, ouml: 246,
	ugrave: 249, uacute: 250, ucirc: 251, uuml: 252,
	ntilde: 241, ccedil: 231, szlig: 223,
};

export function decodeEntities(str: string): string {
	return str.replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|(\w+));/g, (match, dec, hex, named) => {
		if (dec) return String.fromCharCode(parseInt(dec, 10));
		if (hex) return String.fromCharCode(parseInt(hex, 16));
		if (named && NAMED_ENTITIES[named] !== undefined) return String.fromCharCode(NAMED_ENTITIES[named]);
		return match;
	});
}

export function parseDtDd(html: string): Record<string, string> {
	const result: Record<string, string> = {};
	const re = /<dt[^>]*>([^<]+)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(html)) !== null) {
		const key = m[1].replace(/[:\s]+$/g, '').trim();
		// Strip HTML tags from dd value
		const value = decodeEntities(m[2].replace(/<[^>]+>/g, '').trim());
		if (key && value) {
			result[key] = value;
		}
	}
	return result;
}

function cleanTitle(title: string | null): string | null {
	if (!title) return null;
	// OG title is "Ślady | Paulina Cedlerska" — strip author part
	return decodeEntities(title.replace(/\s*\|.*$/, '').trim());
}

function cleanDescription(text: string): string {
	return text.replace(/Powyższy opis pochodzi od wydawcy\.?/gi, '').replace(/\s+/g, ' ').trim();
}

function extractDescription(html: string): string | null {
	// Try #book-description or collapse-content
	let m = html.match(/id="book-description"[^>]*>([\s\S]*?)<\/div>/);
	if (!m) {
		m = html.match(/class="collapse-content"[^>]*>([\s\S]*?)<\/div>/);
	}
	if (!m) {
		// Fallback to og:description
		m = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/);
		const raw = m?.[1]?.trim();
		return raw ? cleanDescription(decodeEntities(raw)) || null : null;
	}
	// Strip tags and clean whitespace
	const raw = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
	if (!raw) return null;
	return cleanDescription(decodeEntities(raw)) || null;
}

export function parseBook(html: string, bookId: string) {
	const get = (pattern: RegExp, group = 1): string | null => {
		const m = html.match(pattern);
		return m?.[group]?.trim() ? decodeEntities(m[group].trim()) : null;
	};

	// Canonical URL & slug
	const canonicalUrl = get(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/);
	const slug = canonicalUrl?.match(/\/ksiazka\/\d+\/([^\/?"]+)/)?.[1] || null;

	// Title
	const title = get(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/);

	// Authors: <span class="author ..."> may contain multiple <a class="link-name" href="/autor/ID/...">
	const authorBlockMatch = html.match(/<span[^>]+class="author[^"]*"[^>]*>([\s\S]*?)<\/span>/);
	const authors: Author[] = [];
	if (authorBlockMatch) {
		const authorLinks = [...authorBlockMatch[1].matchAll(/<a[^>]+href="([^"]*\/autor\/(\d+)\/[^"]*)"[^>]*>([^<]+)<\/a>/g)];
		for (const m of authorLinks) {
			const href = m[1].startsWith('http') ? m[1] : `https://lubimyczytac.pl${m[1]}`;
			authors.push({ id: m[2], name: decodeEntities(m[3].trim()), url: href });
		}
	}

	// Publisher: <a href="/wydawnictwo/2918/filia">
	const publisherMatch = html.match(/<a[^>]+href="([^"]*\/wydawnictwo\/(\d+)\/[^"]*)"[^>]*>([^<]+)<\/a>/);
	const publisher = publisherMatch
		? {
			id: publisherMatch[2],
			name: decodeEntities(publisherMatch[3].trim()),
			url: publisherMatch[1].startsWith('http') ? publisherMatch[1] : `https://lubimyczytac.pl${publisherMatch[1]}`,
		}
		: null;

	// Category ID from breadcrumbs: <a href="/ksiazki/k/53/kryminal-sensacja-thriller">
	const categoryIdMap: Record<string, string> = {};
	const breadcrumbLinks = [...html.matchAll(/<a[^>]+href="[^"]*\/ksiazki\/k\/(\d+)\/([^"]+)"[^>]*>/g)];
	for (const m of breadcrumbLinks) {
		categoryIdMap[m[2].trim()] = m[1];
	}

	// Category: extracted from <dt>Kategoria:</dt><dd><a href="/kategoria/beletrystyka/slug">
	const categories: Category[] = [];
	const catDtMatch = html.match(/<dt[^>]*>\s*Kategoria[:\s]*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i);
	if (catDtMatch) {
		const catLinks = [...catDtMatch[1].matchAll(/<a[^>]+href="[^"]*\/kategoria\/([^"]+)"[^>]*>([^<]+)<\/a>/g)];
		for (const m of catLinks) {
			const fullSlug = m[1].trim();
			// Last segment of slug matches breadcrumb key (e.g. "beletrystyka/kryminal-sensacja-thriller" → "kryminal-sensacja-thriller")
			const lastSegment = fullSlug.split('/').pop() || '';
			categories.push({
				id: categoryIdMap[lastSegment] || null,
				slug: fullSlug,
				name: decodeEntities(m[2].trim()),
			});
		}
	}

	// Series/Cykl: <dt>Cykl:</dt><dd><a href="/cykl/143/...">Harry Potter (tom 2)</a></dd>
	let series: { id: string; name: string; volume: number | null } | null = null;
	const cyklDtMatch = html.match(/<dt[^>]*>\s*Cykl[:\s]*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i);
	if (cyklDtMatch) {
		const cyklLink = cyklDtMatch[1].match(/<a[^>]+href="[^"]*\/cykl\/(\d+)\/[^"]*"[^>]*>([^<]+)<\/a>/);
		if (cyklLink) {
			const rawName = cyklLink[2].trim();
			const volMatch = rawName.match(/\(tom\s+(\d+)\)\s*$/);
			series = {
				id: cyklLink[1],
				name: decodeEntities(rawName.replace(/\s*\(tom\s+\d+\)\s*$/, '').trim()),
				volume: volMatch ? parseInt(volMatch[1]) : null,
			};
		}
	}

	// Publishing series / Seria wydawnicza: <dt>Seria:</dt><dd><a href="/seria/9663/...">Mroczna strona</a></dd>
	let publishingSeries: { id: string; name: string } | null = null;
	const seriaDtMatch = html.match(/<dt[^>]*>\s*Seria[:\s]*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i);
	if (seriaDtMatch) {
		const seriaLink = seriaDtMatch[1].match(/<a[^>]+href="[^"]*\/seria\/(\d+)\/[^"]*"[^>]*>([^<]+)<\/a>/);
		if (seriaLink) {
			publishingSeries = { id: seriaLink[1], name: decodeEntities(seriaLink[2].trim()) };
		}
	}

	// Other editions: <div id="other-editions"> contains <a href="/ksiazka/ID/slug">
	const otherEditions: Record<string, unknown>[] = [];
	const editionsSectionMatch = html.match(/id="other-editions"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
	if (editionsSectionMatch) {
		const edLinks = [...editionsSectionMatch[1].matchAll(/<a[^>]+href="(\/ksiazka\/(\d+)\/[^"]+)"[^>]*>/g)];
		for (const m of edLinks) {
			// Skip the /wydania/ link
			if (!m[0].includes('/wydania/')) {
				const edUrl = m[1].startsWith('http') ? m[1] : `https://lubimyczytac.pl${m[1]}`;
				otherEditions.push({ id: m[2], url: edUrl });
			}
		}
	}

	// DT/DD pairs for structured details
	const details = parseDtDd(html);

	// Translators: <dt>Tłumacz:</dt><dd> may contain multiple <a href="/tlumacz/ID/...">
	const translatorDtMatch = html.match(/<dt[^>]*>\s*T[łl]umacz[:\s]*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/i);
	const translators: Translator[] = [];
	if (translatorDtMatch) {
		const tLinks = [...translatorDtMatch[1].matchAll(/<a[^>]+href="[^"]*\/tlumacz\/(\d+)\/[^"]*"[^>]*>([^<]+)<\/a>/g)];
		if (tLinks.length > 0) {
			for (const m of tLinks) {
				translators.push({ id: m[1], name: decodeEntities(m[2].trim()) });
			}
		} else {
			// Fallback: plain text (no links)
			const plainName = translatorDtMatch[1].replace(/<[^>]+>/g, '').trim();
			if (plainName) {
				translators.push({ id: null, name: plainName });
			}
		}
	}

	// Rating from meta
	const rating = get(/<meta[^>]+property="books:rating:value"[^>]+content="([^"]+)"/);

	// Ratings & reviews count from text
	const ratingsCount = get(/(\d+)\s*ocen/);
	const reviewsCount = get(/(\d+)\s*opini/);

	// Description
	const lcDescription = extractDescription(html);
	const descriptions: { source: string; text: string }[] = [];
	if (lcDescription) {
		descriptions.push({ source: 'lubimyczytac.pl', text: lcDescription });
	}

	// Cover
	const coverUrl = get(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);

	// ISBN
	const isbn = details['ISBN'] || get(/<meta[^>]+property="books:isbn"[^>]+content="([^"]+)"/);

	return {
		source: 'lubimyczytac.pl',
		id: bookId,
		url: canonicalUrl,
		title: cleanTitle(title),
		authors,
		descriptions,
		coverUrl,
		coverUrlOriginal: coverUrl,
		isbn,
		publisher,
		categories,
		series,
		publishingSeries,
		rating: rating ? parseFloat(rating) : null,
		ratingsCount: ratingsCount ? parseInt(ratingsCount) : null,
		reviewsCount: reviewsCount ? parseInt(reviewsCount) : null,
		pages: details['Liczba stron'] ? parseInt(details['Liczba stron']) : null,
		format: details['Format'] || null,
		publishDate: details['Data wydania'] || null,
		firstLocalPublishDate: details['Data 1. wyd. pol.'] || null,
		firstPublishDate: details['Data 1. wydania'] || null,
		language: details['Język'] || null,
		readingTime: details['Czas czytania']?.replace(/\s+/g, ' ') || null,
		originalTitle: details['Tytuł oryginału'] || null,
		translators,
		otherEditions,
		bookstores: [] as BookstoreLink[],
		dimensions: null as { heightMm: number; widthMm: number; depthMm: number } | null,
		editionNumber: null as number | null,
		originalLanguage: null as string | null,
		ean: null as string | null,
	};
}

export function parseCatalog(html: string): CatalogBook[] {
	const books: CatalogBook[] = [];

	// Each book is in .authorAllBooks__single, containing a form with action="/ksiazka/ID/slug"
	const itemRegex = /class="authorAllBooks__single"([\s\S]*?)(?=class="authorAllBooks__single"|$)/g;
	let itemMatch: RegExpExecArray | null;

	while ((itemMatch = itemRegex.exec(html)) !== null) {
		const block = itemMatch[1];

		// Book link: action="/ksiazka/5231522/paradise-club" or href="/ksiazka/..."
		const bookLinkMatch = block.match(/(?:action|href)="\/ksiazka\/(\d+)\/([^"]+)"/);
		if (!bookLinkMatch) continue;

		const id = bookLinkMatch[1];
		const slug = bookLinkMatch[2];

		// Title: <a class="authorAllBooks__singleTextTitle ...">  \n  Title  \n  </a>
		const titleMatch = block.match(/class="authorAllBooks__singleTextTitle[^"]*"[^>]*>([\s\S]*?)<\/a>/);
		const title = titleMatch ? decodeEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim()) : '';

		// Authors: <div class="authorAllBooks__singleTextAuthor..."><a href="/autor/ID/slug">Name</a></div>
		const authors: Author[] = [];
		const authorSection = block.match(/class="authorAllBooks__singleTextAuthor[^"]*"[^>]*>([\s\S]*?)<\/div>/);
		if (authorSection) {
			const authorRegex = /<a[^>]+href="([^"]*\/autor\/(\d+)\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
			let am: RegExpExecArray | null;
			while ((am = authorRegex.exec(authorSection[1])) !== null) {
				const catAuthorUrl = am[1].startsWith('http') ? am[1] : `https://lubimyczytac.pl${am[1]}`;
				authors.push({ id: am[2], name: decodeEntities(am[3].replace(/<[^>]+>/g, '').trim()), url: catAuthorUrl });
			}
		}

		// Rating: <span class="listLibrary__ratingStarsNumber"> \n 7,3</span>
		const ratingMatch = block.match(/class="listLibrary__ratingStarsNumber"[^>]*>([\s\S]*?)<\/span>/);
		const ratingStr = ratingMatch?.[1]?.trim()?.replace(',', '.');
		const rating = ratingStr ? parseFloat(ratingStr) : null;

		// Cover image
		const imgMatch = block.match(/src="(https:\/\/s\.lubimyczytac\.pl\/upload\/books\/[^"]+)"/);
		const coverUrl = imgMatch?.[1] || null;

		books.push({
			source: 'lubimyczytac.pl',
			id,
			url: `https://lubimyczytac.pl/ksiazka/${id}/${slug}`,
			title,
			authors,
			rating: rating && rating > 0 ? rating : null,
			coverUrl,
		});
	}

	return books;
}

export function parseAuthor(html: string, authorId: string, authorUrl: string): AuthorDetails {
	const get = (pattern: RegExp, group = 1): string | null => {
		const m = html.match(pattern);
		return m?.[group]?.trim() ? decodeEntities(m[group].trim()) : null;
	};

	// Name
	const name = get(/<h1[^>]*author-main__header-name[^>]*>([^<]+)<\/h1>/) || '';

	// Photo: high-res 352x500 from <picture> source srcset
	const photoUrl = get(/<picture[^>]*author-info__photo[^>]*>[\s\S]*?<source[^>]+srcset="([^"]+)"/) || null;

	// Birth date: <span class='author-info__born'>...<bold>Urodzony:</bold> DD.MM.YYYY</span>
	const birthDate = get(/author-info__born[^>]*>[\s\S]*?Urodzony:<\/span>\s*(\d{2}\.\d{2}\.\d{4})/) || null;

	// Death date: <span class='author-info__dead'>...<bold>Zmarły:</bold> DD.MM.YYYY</span>
	const deathDate = get(/author-info__dead[^>]*>[\s\S]*?Zmar[łl]y:<\/span>\s*(\d{2}\.\d{2}\.\d{4})/) || null;

	// Description: div.author-info__content.expand-collapse-content
	let description: string | null = null;
	const descMatch = html.match(/class="author-info__content\s+expand-collapse-content"[^>]*>([\s\S]*?)<\/div>/);
	if (descMatch) {
		const raw = descMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();
		description = raw ? decodeEntities(raw) : null;
	}

	// Website
	const website = get(/<[^>]*author-info--website[^>]*>([^<]+)/) || null;

	// Aliases: linked pen names inside other-names span
	const aliases: Author[] = [];
	const aliasBlock = html.match(/author-info__other-names[^>]*>([\s\S]*?)<\/span>\s*<\/div>/);
	if (aliasBlock) {
		const aliasLinks = [...aliasBlock[1].matchAll(/<a[^>]+href="([^"]*\/autor\/(\d+)\/[^"]*)"[^>]*>([^<]+)<\/a>/g)];
		for (const m of aliasLinks) {
			const aliasUrl = m[1].startsWith('http') ? m[1] : `https://lubimyczytac.pl${m[1]}`;
			aliases.push({ id: m[2], name: decodeEntities(m[3].trim()), url: aliasUrl });
		}
	}

	// Books count: inside author-info__col--books → author-info__count
	const booksCountMatch = html.match(/author-info__col--books[\s\S]*?author-info__count[^>]*>[\s\S]*?<\/i>(\d[\d\s]*)</);
	const booksCount = booksCountMatch ? parseNumber(booksCountMatch[1]) : null;

	// Author's average rating: inside author-info__count--rate → rating__avarage
	const ratingMatch = html.match(/author-info__count--rate[\s\S]*?rating__avarage[^>]*>([^<]+)/);
	const rating = ratingMatch ? parseNumber(ratingMatch[1]) : null;

	// Genres: from author-info__categories-content, each <a> text
	const genres: string[] = [];
	const genresBlock = html.match(/author-info__categories-content[^>]*>([\s\S]*?)<\/div>/);
	if (genresBlock) {
		const genreLinks = [...genresBlock[1].matchAll(/<a[^>]*>([^<]+)<\/a>/g)];
		for (const m of genreLinks) {
			genres.push(decodeEntities(m[1].trim()));
		}
	}

	// Readers stats: author-box__readers-col spans
	const readersCols = [...html.matchAll(/author-box__readers-col[^>]*><span>([^<]+)<\/span>\s*([^<]*)/g)];
	const readersCount = readersCols.length > 0 ? parseNumber(readersCols[0][1]) : null;
	const wantToReadCount = readersCols.length > 1 ? parseNumber(readersCols[1][1]) : null;

	// Fans count: icon-fans...</i>NUMBER</span>
	const fansMatch = html.match(/icon-fans[^<]*<\/i>([\d\s]+)<\/span>/);
	const fansCount = fansMatch ? parseNumber(fansMatch[1]) : null;

	// Most popular book
	let mostPopularBook: AuthorDetails['mostPopularBook'] = null;
	const bestSection = html.match(/class="author-best">([\s\S]*?)(?=<div class="author-info|<div class="author-box)/);
	if (bestSection) {
		const best = bestSection[1];
		const titleMatch = best.match(/author-best__book-title[^>]*href="([^"]*\/ksiazka\/(\d+)\/[^"]*)"[^>]*>([^<]+)/);
		const coverMatch = best.match(/author-best__cover-image[^>]*src="([^"]+)"/);
		const bestRatingMatch = best.match(/rating__avarage[^>]*>([^<]+)/);
		const bestRatingsCountMatch = best.match(/z\s+([\d\s]+)\s*ocen/);
		const highlightedMatches = [...best.matchAll(/author-best__highlighted[^>]*>\s*([\d\s]+)<\/span>\s*([^<]*)/g)];
		let bestReadersCount: number | null = null;
		let bestReviewsCount: number | null = null;
		for (const h of highlightedMatches) {
			const text = h[2].trim().toLowerCase();
			if (text.includes('czytelnik')) bestReadersCount = parseNumber(h[1]);
			else if (text.includes('opini')) bestReviewsCount = parseNumber(h[1]);
		}

		if (titleMatch) {
			mostPopularBook = {
				id: titleMatch[2],
				title: decodeEntities(titleMatch[3].trim()),
				url: `https://lubimyczytac.pl${titleMatch[1]}`,
				coverUrl: coverMatch?.[1] || null,
				rating: bestRatingMatch ? parseNumber(bestRatingMatch[1]) : null,
				ratingsCount: bestRatingsCountMatch ? parseNumber(bestRatingsCountMatch[1]) : null,
				readersCount: bestReadersCount,
				reviewsCount: bestReviewsCount,
			};
		}
	}

	return {
		id: authorId,
		name,
		url: authorUrl,
		photoUrl,
		birthDate,
		deathDate,
		description,
		website,
		aliases,
		booksCount,
		rating,
		readersCount,
		wantToReadCount,
		fansCount,
		genres,
		mostPopularBook,
	};
}

function parseNumber(str: string | null | undefined): number | null {
	if (!str) return null;
	const cleaned = str.replace(/\s+/g, '').replace(',', '.');
	const n = parseFloat(cleaned);
	return isNaN(n) ? null : n;
}

export function parsePublisher(html: string, publisherId: string, publisherUrl: string): PublisherDetails {
	// Name: <h1 class="book__title">Filia</h1>
	const nameMatch = html.match(/<h1[^>]*book__title[^>]*>([\s\S]*?)<\/h1>/);
	const name = nameMatch ? decodeEntities(nameMatch[1].trim()) : '';

	// Logo: <img src="https://s.lubimyczytac.pl/upload/publishers/2918/2918-b.jpg"
	const logoMatch = html.match(/src="(https:\/\/s\.lubimyczytac\.pl\/upload\/publishers\/[^"]+)"/);
	const logoUrl = logoMatch?.[1] || null;

	// Description: inside #publisher-description .collapse-content
	let description: string | null = null;
	const descMatch = html.match(/id="publisher-description"[^>]*>[\s\S]*?class="collapse-content"[^>]*>([\s\S]*?)<\/div>/);
	if (descMatch) {
		const raw = descMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();
		description = raw ? decodeEntities(raw) : null;
	}

	// Website: link with data-original-title="strona wydawnictwa"
	const websiteMatch = html.match(/<a[^>]+href="([^"]+)"[^>]+data-original-title="strona wydawnictwa"/);
	const website = websiteMatch?.[1] || null;

	// Stats from icon-based items: books count, awards, series, cycles
	const booksCountMatch = html.match(/icon-book[^>]*>[\s\S]*?<\/i>\s*([\d\s]+)\s*książ/);
	const booksCount = booksCountMatch ? parseNumber(booksCountMatch[1]) : null;

	const awardsMatch = html.match(/icon-icon-awards[^>]*>[\s\S]*?<\/i>\s*([\d\s]+)\s*nagr/);
	const awardsCount = awardsMatch ? parseNumber(awardsMatch[1]) : null;

	const seriesMatch = html.match(/action="\/serie\/lista"[\s\S]*?<span[^>]*>\s*[\s\S]*?icon[^>]*>[\s\S]*?<\/i>\s*([\d\s]+)\s*seri/);
	const seriesCount = seriesMatch ? parseNumber(seriesMatch[1]) : null;

	const cyclesMatch = html.match(/action="\/cykle\/lista"[\s\S]*?<span[^>]*>\s*[\s\S]*?icon[^>]*>[\s\S]*?<\/i>\s*([\d\s]+)\s*cykl/);
	const cyclesCount = cyclesMatch ? parseNumber(cyclesMatch[1]) : null;

	// Readers stats: authorMain__ratingListItem <strong>NUMBER</strong> przeczytało / chce przeczytać
	const ratingItems = [...html.matchAll(/authorMain__ratingListItem[^>]*>\s*<strong>\s*([\d\s]+)\s*<\/strong>\s*([\s\S]*?)<\/li>/g)];
	let readersCount: number | null = null;
	let wantToReadCount: number | null = null;
	for (const m of ratingItems) {
		const text = m[2].trim().toLowerCase();
		if (text.includes('przeczytał')) readersCount = parseNumber(m[1]);
		else if (text.includes('chce przeczytać')) wantToReadCount = parseNumber(m[1]);
	}

	// Fans count: authorMain__ratingFansCountNumber
	const fansMatch = html.match(/authorMain__ratingFansCountNumber[^>]*>\s*([\d\s]+)\s*<\/span>/);
	const fansCount = fansMatch ? parseNumber(fansMatch[1]) : null;

	// Categories: links after "wydaje w swojej ofercie głównie"
	const categories: { slug: string; name: string }[] = [];
	const catBlock = html.match(/wydaje w swojej ofercie głównie[\s\S]*?<\/div>/);
	if (catBlock) {
		const catLinks = [...catBlock[0].matchAll(/<a[^>]+href="[^"]*\/kategoria\/([^"]+)"[^>]*>([^<]+)<\/a>/g)];
		for (const m of catLinks) {
			categories.push({ slug: m[1], name: decodeEntities(m[2].trim()) });
		}
	}

	return {
		id: publisherId,
		name,
		url: publisherUrl,
		logoUrl,
		description,
		website,
		booksCount,
		awardsCount,
		seriesCount,
		cyclesCount,
		readersCount,
		wantToReadCount,
		fansCount,
		categories,
	};
}

export async function fetchPublisherDetails(publisherUrl: string, publisherId: string): Promise<PublisherDetails | null> {
	const cacheKey = `publisher:${publisherId}`;
	const cached = await cacheGet<PublisherDetails>(cacheKey);
	if (cached !== MISS) return cached;

	try {
		const res = await fetch(publisherUrl, {
			headers: randomHeaders(),
			redirect: 'follow',
		});
		if (!res.ok) return null;
		const html = await res.text();
		const result = parsePublisher(html, publisherId, publisherUrl);
		await cacheSet(cacheKey, result, TTL_30_DAYS);
		return result;
	} catch {
		return null;
	}
}

export async function fetchAuthorDetails(authorUrl: string, authorId: string): Promise<AuthorDetails | null> {
	const cacheKey = `author:${authorId}`;
	const cached = await cacheGet<AuthorDetails>(cacheKey);
	if (cached !== MISS) return cached;

	try {
		const res = await fetch(authorUrl, {
			headers: randomHeaders(),
			redirect: 'follow',
		});
		if (!res.ok) return null;
		const html = await res.text();
		const result = parseAuthor(html, authorId, authorUrl);
		await cacheSet(cacheKey, result, TTL_30_DAYS);
		return result;
	} catch {
		return null;
	}
}

/**
 * Extract the buybox.click API URL from the page's JavaScript.
 * The page calls: fetchBBOffers('https://buybox.click/17929/buybox.json?...')
 */
export function extractBuyboxUrl(html: string): string | null {
	const m = html.match(/fetchBBOffers\(\s*'([^']+)'\s*\)/);
	return m?.[1] || null;
}

/**
 * Fetch bookstore offers from the buybox.click API and normalize to BookstoreLink[].
 */
export async function fetchBookstores(buyboxUrl: string): Promise<BookstoreLink[]> {
	try {
		const res = await fetch(buyboxUrl, {
			headers: { 'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] },
		});
		if (!res.ok) return [];

		const json = (await res.json()) as { status: boolean; data: Record<string, BuyboxOffer> };
		if (!json.status || !json.data) return [];

		return Object.entries(json.data).map(([url, offer]) => ({
			name: offer.name,
			url,
			price: offer.price ? parseFloat(offer.price) : null,
			currency: offer.currency || 'PLN',
			type: offer.type || null,
			itemKind: offer.typeName || null,
		}));
	} catch {
		return [];
	}
}

export async function searchByIsbn(isbn: string): Promise<{id: string, slug: string, title: string} | null> {
	const cacheKey = `isbn:${isbn}`;
	const cached = await cacheGet<{id: string, slug: string, title: string} | null>(cacheKey);
	if (cached !== MISS) return cached;

	try {
		const res = await fetch('https://lubimyczytac.pl/ajax/searchbyparams', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
				'X-Requested-With': 'XMLHttpRequest',
				...randomHeaders(),
			},
			body: `isbn=${isbn}`,
		});
		if (!res.ok) return null;
		const data: any = await res.json();
		if (Array.isArray(data)) {
			await cacheSet(cacheKey, null, TTL_30_DAYS);
			return null;
		}
		const result = { id: data.id, slug: data.seotitle, title: data.title };
		await cacheSet(cacheKey, result, TTL_30_DAYS);
		return result;
	} catch {
		return null;
	}
}

interface BuyboxOffer {
	id: number;
	name: string;
	icon: string;
	logo: string;
	type: string;
	typeId: number;
	typeName: string;
	shopId: number;
	currency: string;
	price: string;
	pricePrefix?: string;
	bbWeight?: number;
}

/**
 * Parse empik.com product page HTML for enrichment data.
 * Uses getAttr() helper that strips tags to find attribute name → value pairs
 * regardless of the HTML structure between them.
 */
export function parseEmpikPage(html: string): EmpikData {
	const get = (pattern: RegExp, group = 1): string | null => {
		const m = html.match(pattern);
		return m?.[group]?.trim() || null;
	};

	// Strip tags from a region to extract text, useful for finding attribute values
	// that may be separated from their labels by HTML tags
	const stripTags = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

	// Search for a labeled value in the stripped-tags text
	const getAttr = (label: RegExp): string | null => {
		const stripped = stripTags(html);
		const m = stripped.match(label);
		return m?.[1]?.trim() || null;
	};

	// High-res cover from og:image (ecsmedia.pl, ~791x1200)
	const coverUrl = get(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
		|| get(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);

	// Dimensions: search in stripped text
	let dimensions: Dimensions | null = null;
	const heightStr = getAttr(/[Ww]ysoko[śs][ćc]\D*?(\d+(?:[.,]\d+)?)\s*(?:mm|cm)/);
	const widthStr = getAttr(/[Ss]zeroko[śs][ćc]\D*?(\d+(?:[.,]\d+)?)\s*(?:mm|cm)/);
	const depthStr = getAttr(/(?:[Gg](?:łębok|rubo[śs][ćc]))\D*?(\d+(?:[.,]\d+)?)\s*(?:mm|cm)/);

	if (heightStr && widthStr) {
		const h = parseFloat(heightStr.replace(',', '.'));
		const w = parseFloat(widthStr.replace(',', '.'));
		const d = depthStr ? parseFloat(depthStr.replace(',', '.')) : 0;
		dimensions = { heightMm: h, widthMm: w, depthMm: d };
	}

	// Edition number
	const editionStr = getAttr(/[Ww]ydanie\D*?(\d+)/);
	const editionNumber = editionStr ? parseInt(editionStr) : null;

	// Original language
	const originalLanguage = getAttr(/[Jj]ęzyk\s+oryginału\D*?([A-Za-zżźćńółęąśŻŹĆŃÓŁĘĄŚ]+)/i);

	// EAN
	const ean = getAttr(/EAN\D*?(\d{13})/i) || get(/data-ean="(\d{13})"/i);

	// Description: first div with "description" in class that has substantial text
	let description: string | null = null;
	const descMatches = [...html.matchAll(/class="[^"]*[Dd]escription[^"]*"[^>]*>([\s\S]*?)<\/div>/g)];
	for (const dm of descMatches) {
		const text = dm[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
		if (text.length > 50) {
			description = cleanDescription(decodeEntities(text)) || null;
			break;
		}
	}

	return {
		coverUrl,
		dimensions,
		editionNumber,
		originalLanguage,
		ean,
		description,
	};
}
