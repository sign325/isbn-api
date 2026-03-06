export interface Author {
	id: string;
	name: string;
	url: string;
}

export interface AuthorDetails {
	id: string;
	name: string;
	url: string;
	photoUrl: string | null;
	birthDate: string | null;
	deathDate: string | null;
	description: string | null;
	website: string | null;
	aliases: Author[];
	booksCount: number | null;
	rating: number | null;
	readersCount: number | null;
	wantToReadCount: number | null;
	fansCount: number | null;
	genres: string[];
	mostPopularBook: {
		id: string;
		title: string;
		url: string;
		coverUrl: string | null;
		rating: number | null;
		ratingsCount: number | null;
		readersCount: number | null;
		reviewsCount: number | null;
	} | null;
}

export interface Publisher {
	id: string;
	name: string;
	url: string;
}

export interface PublisherDetails {
	id: string;
	name: string;
	url: string;
	logoUrl: string | null;
	description: string | null;
	website: string | null;
	booksCount: number | null;
	awardsCount: number | null;
	seriesCount: number | null;
	cyclesCount: number | null;
	readersCount: number | null;
	wantToReadCount: number | null;
	fansCount: number | null;
	categories: { slug: string; name: string }[];
}

export interface Category {
	id: string | null;
	slug: string;
	name: string;
}

export interface Series {
	id: string;
	name: string;
	volume: number | null;
}

export interface PublishingSeries {
	id: string;
	name: string;
}

export interface Translator {
	id: string | null;
	name: string;
}

export interface BookstoreLink {
	name: string;
	url: string;
	price: number | null;
	currency: string | null;
	type: string | null;
	itemKind: string | null;
}

export interface Dimensions {
	heightMm: number;
	widthMm: number;
	depthMm: number;
}

export interface EmpikData {
	coverUrl: string | null;
	dimensions: Dimensions | null;
	editionNumber: number | null;
	originalLanguage: string | null;
	ean: string | null;
	description: string | null;
}

export interface Book {
	source: string;
	id: string;
	url: string | null;
	title: string | null;
	authors: Author[];
	descriptions: { source: string; text: string }[];
	coverUrl: string | null;
	coverUrlOriginal: string | null;
	isbn: string | null;
	publisher: Publisher | null;
	categories: Category[];
	series: Series | null;
	publishingSeries: PublishingSeries | null;
	rating: number | null;
	ratingsCount: number | null;
	reviewsCount: number | null;
	pages: number | null;
	format: string | null;
	publishDate: string | null;
	firstLocalPublishDate: string | null;
	firstPublishDate: string | null;
	language: string | null;
	readingTime: string | null;
	originalTitle: string | null;
	translators: Translator[];
	otherEditions: Record<string, unknown>[];
	bookstores: BookstoreLink[];
	dimensions: Dimensions | null;
	editionNumber: number | null;
	originalLanguage: string | null;
	ean: string | null;
}

export interface CatalogBook {
	source: string;
	id: string;
	url: string;
	title: string;
	authors: Author[];
	rating: number | null;
	coverUrl: string | null;
}
