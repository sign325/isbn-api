import { ProxyAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

const PROXY_URL = process.env.PROXY_URL || 'http://mc45vqoQcVA2GaJ1:gHCmTpxUYC52TcOZ_country-pl@geo.iproyal.com:12321';

// Validate proxy URL format on startup
try {
	const parsed = new URL(PROXY_URL);
	if (!parsed.hostname || !parsed.port) {
		throw new Error('missing hostname or port');
	}
} catch (err: any) {
	console.error(`FATAL: Invalid PROXY_URL: ${err.message}`);
	process.exit(1);
}

const agent = new ProxyAgent(PROXY_URL);
setGlobalDispatcher(agent);

// Override global fetch to guarantee every request goes through the proxy dispatcher.
// This prevents any accidental direct requests if something resets the global dispatcher.
const _origFetch = globalThis.fetch;
globalThis.fetch = function proxyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
	const dispatcher = getGlobalDispatcher();
	if (!(dispatcher instanceof ProxyAgent)) {
		throw new Error('FATAL: Global dispatcher is not a ProxyAgent — refusing to make a direct request');
	}
	return _origFetch(input, init);
};

/**
 * Verify proxy is alive. Call before starting the server.
 * Throws if proxy is unreachable.
 */
export async function verifyProxy(): Promise<void> {
	try {
		const res = await fetch('https://ipv4.icanhazip.com', { signal: AbortSignal.timeout(10000) });
		const ip = (await res.text()).trim();
		console.log(`Proxy OK — external IP: ${ip}`);
	} catch (err: any) {
		console.error(`FATAL: Proxy verification failed: ${err.message}`);
		process.exit(1);
	}
}

export function parseProxyUrl(): { server: string; username: string; password: string } {
	const parsed = new URL(PROXY_URL);
	return {
		server: `${parsed.protocol}//${parsed.hostname}:${parsed.port}`,
		username: decodeURIComponent(parsed.username),
		password: decodeURIComponent(parsed.password),
	};
}

export { PROXY_URL };
