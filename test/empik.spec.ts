import { describe, it, expect } from 'vitest';
import { parseEmpikPage } from '../src/parsers.js';

const sampleEmpikHtml = `
<!DOCTYPE html>
<html>
<head>
	<meta property="og:image" content="https://ecsmedia.pl/c/dobry-omen-w-iext170091234.jpg" />
	<meta property="og:title" content="Dobry omen - Neil Gaiman, Terry Pratchett | Empik.com" />
</head>
<body>
	<div class="product-attributes">
		<div class="attribute">
			<span class="attribute-name">EAN:</span>
			<span class="attribute-value">9788381690867</span>
		</div>
		<div class="attribute">
			<span class="attribute-name">Wydanie:</span>
			<span class="attribute-value">3</span>
		</div>
		<div class="attribute">
			<span class="attribute-name">Język oryginału:</span>
			<span class="attribute-value">angielski</span>
		</div>
		<div class="attribute">
			<span class="attribute-name">Wysokość:</span>
			<span class="attribute-value">205 mm</span>
		</div>
		<div class="attribute">
			<span class="attribute-name">Szerokość:</span>
			<span class="attribute-value">132 mm</span>
		</div>
		<div class="attribute">
			<span class="attribute-name">Grubość:</span>
			<span class="attribute-value">28 mm</span>
		</div>
	</div>
</body>
</html>
`;

describe('parseEmpikPage', () => {
	const result = parseEmpikPage(sampleEmpikHtml);

	it('extracts high-res cover URL from og:image', () => {
		expect(result.coverUrl).toBe('https://ecsmedia.pl/c/dobry-omen-w-iext170091234.jpg');
	});

	it('extracts EAN', () => {
		expect(result.ean).toBe('9788381690867');
	});

	it('extracts edition number', () => {
		expect(result.editionNumber).toBe(3);
	});

	it('extracts original language', () => {
		expect(result.originalLanguage).toBe('angielski');
	});

	it('extracts dimensions', () => {
		expect(result.dimensions).not.toBeNull();
		expect(result.dimensions!.heightMm).toBe(205);
		expect(result.dimensions!.widthMm).toBe(132);
		expect(result.dimensions!.depthMm).toBe(28);
	});
});

describe('parseEmpikPage - missing data', () => {
	const result = parseEmpikPage('<html><head></head><body>Minimal page</body></html>');

	it('returns null for missing cover', () => {
		expect(result.coverUrl).toBeNull();
	});

	it('returns null for missing dimensions', () => {
		expect(result.dimensions).toBeNull();
	});

	it('returns null for missing edition number', () => {
		expect(result.editionNumber).toBeNull();
	});

	it('returns null for missing original language', () => {
		expect(result.originalLanguage).toBeNull();
	});

	it('returns null for missing EAN', () => {
		expect(result.ean).toBeNull();
	});
});
