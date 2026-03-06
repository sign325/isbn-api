import { verifyProxy } from './proxy.js';
import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { serve } from '@hono/node-server';
import { parseBook, parseCatalog, extractBuyboxUrl, fetchBookstores, fetchAuthorDetails, fetchPublisherDetails, searchByIsbn, randomHeaders, sleep, SORT_OPTIONS } from './parsers.js';
import { enrichFromEmpik, closeBrowser } from './empik.js';
import { redis, cacheFlush } from './cache.js';

const AUTH_USER = process.env.AUTH_USER || 'isbn';
const AUTH_PASS = process.env.AUTH_PASS;
if (!AUTH_PASS) {
	console.error('FATAL: AUTH_PASS env var is required');
	process.exit(1);
}

const app = new Hono();

app.use('*', basicAuth({ username: AUTH_USER, password: AUTH_PASS }));

const ALLOWED_PROXY_DOMAINS = ['s.lubimyczytac.pl', 'ecsmedia.pl', 'lubimyczytac.pl'];

function proxyUrl(baseUrl: string, originalUrl: string | null): string | null {
	if (!originalUrl) return null;
	return `${baseUrl}/proxy?url=${encodeURIComponent(originalUrl)}`;
}

app.get('/proxy', async (c) => {
	const url = c.req.query('url');
	if (!url) {
		return c.json({ error: 'Missing ?url= parameter' }, 400);
	}

	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return c.json({ error: 'Invalid URL' }, 400);
	}

	if (!ALLOWED_PROXY_DOMAINS.some((d) => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`))) {
		return c.json({ error: 'Domain not allowed' }, 400);
	}

	try {
		const upstream = await fetch(url, { headers: randomHeaders(), redirect: 'follow' });
		if (!upstream.ok) {
			return c.json({ error: `Upstream error (HTTP ${upstream.status})` }, 502);
		}

		const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
		const body = await upstream.arrayBuffer();

		return new Response(body, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=86400',
			},
		});
	} catch (err: any) {
		return c.json({ error: 'Failed to fetch upstream', details: err.message }, 502);
	}
});

app.get('/latest', async (c) => {
	const page = c.req.query('page') || '1';
	const sort = c.req.query('sort') || 'published-desc';
	const url = `https://lubimyczytac.pl/katalog/ksiazki?page=${page}&catalogSortBy=${sort}`;
	return handleCatalog(c, url);
});

app.get('/new', async (c) => {
	const page = c.req.query('page') || '1';
	const sort = c.req.query('sort') || 'published-desc';
	const url = `https://lubimyczytac.pl/katalog/ksiazki?listId=1&page=${page}&catalogSortBy=${sort}`;
	return handleCatalog(c, url);
});

app.get('/isbn/:isbn', async (c) => {
	const raw = c.req.param('isbn');
	const isbn = raw.replace(/[-\s]/g, '');
	if (!/^\d{10}(\d{3})?$/.test(isbn))
		return c.json({ error: 'Invalid ISBN format' }, 400);

	const result = await searchByIsbn(isbn);
	if (!result)
		return c.json({ error: `Nie znaleziono książki o ISBN ${isbn}` }, 404);

	const bookUrl = `https://lubimyczytac.pl/ksiazka/${result.id}/${result.slug}`;
	return handleBook(c, bookUrl, result.id);
});

app.get('/', async (c) => {
	const fetchUrl = c.req.query('fetch');

	if (!fetchUrl) {
		return c.json({
			usage: 'GET /?fetch=<lubimyczytac.pl URL>',
			endpoints: {
				'/isbn/:isbn': 'Look up a book by ISBN (10 or 13 digits, hyphens allowed)',
				'/latest': 'Latest books catalog (?page=1&sort=published-desc)',
				'/new': 'New releases (?page=1&sort=published-desc)',
				'/?fetch=URL': 'Fetch any lubimyczytac.pl URL',
			},
			examples: [
				'/isbn/9788384410363',
				'/isbn/978-83-8441-036-3',
				'/?fetch=https://lubimyczytac.pl/ksiazka/4884797/dobry-omen',
				'/?fetch=https://lubimyczytac.pl/katalog/ksiazki?page=1&catalogSortBy=published-desc',
			],
		});
	}

	if (!fetchUrl.includes('lubimyczytac.pl')) {
		return c.json({ error: 'URL musi być z lubimyczytac.pl' }, 400);
	}

	// Detect URL type from the path
	const urlObj = new URL(fetchUrl);
	const path = urlObj.pathname;

	// Book: /ksiazka/ID/slug
	const bookMatch = path.match(/\/ksiazka\/(\d+)/);
	if (bookMatch) {
		return handleBook(c, fetchUrl, bookMatch[1]);
	}

	// Catalog: /katalog/...
	if (path.includes('/katalog/')) {
		return handleCatalog(c, fetchUrl);
	}

	return c.json({ error: 'Nieobsługiwany typ URL. Obsługiwane: /ksiazka/..., /katalog/...' }, 400);
});

async function handleBook(c: any, bookUrl: string, bookId: string) {
	try {
		const res = await fetch(bookUrl, {
			headers: randomHeaders(),
			redirect: 'follow',
		});

		if (!res.ok) {
			return c.json({ error: `Nie znaleziono książki (HTTP ${res.status})` }, res.status);
		}

		const html = await res.text();
		const book = parseBook(html, bookId);

		// Fetch bookstores from buybox.click API (runs in parallel with editions)
		const buyboxUrl = extractBuyboxUrl(html);
		const bookstoresPromise = buyboxUrl ? fetchBookstores(buyboxUrl) : Promise.resolve([]);

		// Fetch details for each other edition with delay between requests
		if (book.otherEditions.length > 0) {
			const detailed: typeof book.otherEditions = [];
			for (let i = 0; i < book.otherEditions.length; i++) {
				if (i > 0) await sleep(300);
				const ed = book.otherEditions[i] as { id: string; url: string };
				try {
					const edRes = await fetch(ed.url, {
						headers: randomHeaders(),
						redirect: 'follow',
					});
					if (edRes.ok) {
						const edHtml = await edRes.text();
						const { otherEditions: _, ...edBook } = parseBook(edHtml, ed.id);
						detailed.push(edBook);
					} else {
						detailed.push(ed);
					}
				} catch {
					detailed.push(ed);
				}
			}
			book.otherEditions = detailed;
		}

		// Assign bookstores (resolved from parallel fetch)
		book.bookstores = await bookstoresPromise;

		// Empik enrichment (always runs, fails gracefully)
		try {
			const empikData = await enrichFromEmpik(book.bookstores);
			if (empikData) {
				if (empikData.coverUrl) {
					book.coverUrl = empikData.coverUrl;
				}
				if (empikData.dimensions) {
					book.dimensions = empikData.dimensions;
				}
				if (empikData.editionNumber != null) {
					book.editionNumber = empikData.editionNumber;
				}
				if (empikData.originalLanguage) {
					book.originalLanguage = empikData.originalLanguage;
				}
				if (empikData.ean) {
					book.ean = empikData.ean;
				}
				if (empikData.description) {
					book.descriptions.push({ source: 'empik.com', text: empikData.description });
				}
			}
		} catch {
			// Enrichment failed — book is still returned with lubimyczytac data
		}

		// Enrich publisher with full details
		if (book.publisher) {
			const pubDetails = await fetchPublisherDetails(book.publisher.url, book.publisher.id);
			if (pubDetails) {
				(book as any).publisher = pubDetails;
			}
		}

		// Enrich authors with full details from their pages
		const enrichedAuthors: any[] = [];
		for (let i = 0; i < book.authors.length; i++) {
			if (i > 0) await sleep(300);
			const author = book.authors[i];
			const details = await fetchAuthorDetails(author.url, author.id);
			enrichedAuthors.push(details || author);
		}
		(book as any).authors = enrichedAuthors;

		// Rewrite cover URLs to proxy
		const baseUrl = new URL(c.req.url).origin;
		book.coverUrl = proxyUrl(baseUrl, book.coverUrl);
		book.coverUrlOriginal = proxyUrl(baseUrl, book.coverUrlOriginal);
		for (const ed of book.otherEditions) {
			if ('coverUrl' in ed && typeof ed.coverUrl === 'string') {
				ed.coverUrl = proxyUrl(baseUrl, ed.coverUrl);
			}
		}
		// Proxy publisher logo URL
		if ((book as any).publisher?.logoUrl) {
			(book as any).publisher.logoUrl = proxyUrl(baseUrl, (book as any).publisher.logoUrl);
		}
		// Proxy author image URLs
		for (const author of (book as any).authors) {
			if (author.photoUrl) {
				author.photoUrl = proxyUrl(baseUrl, author.photoUrl);
			}
			if (author.mostPopularBook?.coverUrl) {
				author.mostPopularBook.coverUrl = proxyUrl(baseUrl, author.mostPopularBook.coverUrl);
			}
		}

		return c.json(book);
	} catch (err: any) {
		return c.json({ error: 'Błąd pobierania strony', details: err.message }, 500);
	}
}

async function handleCatalog(c: any, catalogUrl: string) {
	try {
		const res = await fetch(catalogUrl, {
			headers: randomHeaders(),
			redirect: 'follow',
		});

		if (!res.ok) {
			return c.json({ error: `Błąd katalogu (HTTP ${res.status})` }, res.status);
		}

		const html = await res.text();
		const books = parseCatalog(html);

		// Rewrite cover URLs to proxy
		const baseUrl = new URL(c.req.url).origin;
		for (const book of books) {
			book.coverUrl = proxyUrl(baseUrl, book.coverUrl);
		}

		return c.json({ count: books.length, books });
	} catch (err: any) {
		return c.json({ error: 'Błąd pobierania katalogu', details: err.message }, 500);
	}
}

const port = parseInt(process.env.PORT || '3000');

// Verify proxy is alive, then start the server
await verifyProxy();
cacheFlush().catch(() => {});

serve({ fetch: app.fetch, port }, (info) => {
	console.log(`Listening on http://localhost:${info.port}`);
});

// Cleanup on shutdown
process.on('SIGINT', async () => {
	await closeBrowser();
	await redis.quit().catch(() => {});
	process.exit(0);
});

process.on('SIGTERM', async () => {
	await closeBrowser();
	await redis.quit().catch(() => {});
	process.exit(0);
});

export default app;
