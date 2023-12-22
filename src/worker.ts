import { Buffer } from 'node:buffer';
import { KVNamespace } from '@cloudflare/workers-types';
import { Resvg, ResvgRenderOptions, initWasm } from '@resvg/resvg-wasm';
import resvgwasm from './index_bg.wasm' assert { type: 'wasm' };

interface Env {
	CACHE: KVNamespace;
}

try {
	await initWasm(resvgwasm as WebAssembly.Module);
} catch (error) {
	console.error('Resvg wasm not initialized');
}

export default {
	async fetch(request, env, ctx) {
		const { pathname } = new URL(request.url);

		const route = _ROUTES[pathname];
		const res = response(request);

		if (route) {
			return await route(request, env, ctx);
		} else {
			return res.json({
				message: 'Not found',
				code: 404,
			});
		}
	},
};

const router = {
	async get(path, handler) {
		_ROUTES[path] = handler;
	},
};
const _ROUTES = {};

const response = (request) => {
	// response#json
	function json(data) {
		return new Response(JSON.stringify(data), {
			headers: {
				'content-type': 'application/json;charset=UTF-8',
			},
		});
	}

	// response#text
	function text(data) {
		return new Response(data, {
			headers: {
				'content-type': 'text/plain;charset=UTF-8',
			},
		});
	}

	// response#html
	function html(data) {
		return new Response(data, {
			headers: {
				'content-type': 'text/html;charset=UTF-8',
			},
		});
	}

	// response#proxy
	function proxy(url) {
		return fetch(url);
	}

	// response#redirect
	function redirect(url) {
		return new Response(null, {
			status: 301,
			headers: {
				location: url,
			},
		});
	}

	// response#image
	function image(data) {
		return new Response(data, {
			headers: {
				'content-type': 'image/png',
			},
		});
	}

	// response#svg
	function svg(data) {
		return new Response(data, {
			headers: {
				'content-type': 'image/svg+xml',
			},
		});
	}

	return {
		json,
		text,
		html,
		proxy,
		image,
		redirect,
		svg,
		url: request.url,
		path: new URL(request.url).pathname,
		host: new URL(request.url).host,
		proto: new URL(request.url).protocol,
	};
};

// library ends here

router.get('/', (request, env, ctx) => {
	const res = response(request);
	return res.json({
		message: 'Hello world',
		code: 200,
		endpoints: {
			echo: {
				method: 'GET',
				path: '/echo',
				params: {
					message: 'string',
				},
				description: 'Echo back the message',
			},
			proxy: {
				method: 'GET',
				path: '/proxy',
				params: {
					url: 'string',
				},
				description: 'Proxy the request to the given url',
			},
			stats: {
				method: 'GET',
				path: '/stats',
				description: 'Get stats',
			},
			nowplaying: {
				method: 'GET',
				path: '/nowplaying',
				description: 'Get my current nowplaying track from last.fm',
			},
			nowplaying_svg: {
				method: 'GET',
				path: '/nowplaying.svg',
				description: 'Get my current nowplaying track from last.fm as an svg',
				params: {
					background: 'string',
					title: 'string',
					subtitle: 'string',
					rounded: 'string',
				},
			},
		},
	});
});

router.get('/proxy', (request, env, ctx) => {
	const res = response(request);
	const { searchParams } = new URL(request.url);
	const url = searchParams.get('url');
	return res.proxy(url);
});

router.get('/stats', async (request, env, ctx) => {
	const res = response(request);

	let last_nowplaying;

	try {
		last_nowplaying = await env.CACHE.get('last_nowplaying');
	} catch (e) {
		return res.json({
			message: 'Error',
			code: 500,
			error: e,
		});
	} finally {
		if (!last_nowplaying) {
			last_nowplaying = Date.now();
			await env.CACHE.put('last_nowplaying', last_nowplaying);
		}
	}

	return res.json({
		message: 'Stats',
		code: 200,
		stats: {
			last_nowplaying,
		},
	});
});

router.get('/echo', (request, env, ctx) => {
	const res = response(request);
	const { searchParams } = new URL(request.url);
	const message = searchParams.get('message');
	return res.json({
		message,
		code: 200,
	});
});

router.get('/nowplaying.svg', async (request, env, ctx) => {
	const res = response(request);

	return res.svg(await getNowPlayingSVG(request, env));
});

router.get('/nowplaying.png', async (request, env, ctx) => {
	const res = response(request);

	const svg = await getNowPlayingSVG(request, env);

	const font = await fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexsans/IBMPlexSans-Bold.ttf');
	const fontData = await font.arrayBuffer();
	const buffer = new Uint8Array(fontData);

	const opts = {
		font: {
			loadSystemFonts: false,
			defaultFontFamily: 'IBM Plex Sans',
			fontBuffers: [buffer],
		},
	};

	const resvg = new Resvg(svg, opts);
	const resolved = await Promise.all(
		resvg.imagesToResolve().map(async (url) => {
			const img = await fetch(url);
			console.log('resolving', url);
			const buffer = await img.arrayBuffer();
			return {
				url,
				buffer: new Uint8Array(buffer),
			};
		})
	);
	if (resolved.length > 0) {
		for (const result of resolved) {
			const { url, buffer } = result;
			resvg.resolveImage(url, buffer);
		}
	}
	const pngData = resvg.render();
	const pngBuffer = pngData.asPng();

	return res.image(pngBuffer);
});

router.get('/debug', async (request, env, ctx) => {
	const blob = new Blob(['Hello, world!'], { type: 'text/plain' });
	const url = URL.createObjectURL(blob);

	const res = response(request);

	return res.json({
		message: 'Debug',
		code: 200,
		url,
	});
});

router.get('/nowplaying', async (request, env, ctx) => {
	// based on the code sent by dimden on their discord server, ty <3
	// https://discord.com/channels/503244758966337546/628124693378891786/1187192265026838591
	// join it! https://discord.gg/yaqzbDBaAA
	const res = response(request);

	const { last_nowplaying, cached_lastfm, cached } = await getNowPlaying(request, env);

	return res.json({
		message: 'Now playing',
		code: 200,
		date: last_nowplaying,
		sent: Date.now(),
		cached,
		nowplaying: cached_lastfm,
	});
});

const getNowPlaying = async (request, env) => {
	let last_nowplaying;
	let cached_lastfm = {};
	let cached = true;

	try {
		last_nowplaying = parseInt(await env.CACHE.get('last_nowplaying'));
		cached_lastfm = JSON.parse(await env.CACHE.get('cached_lastfm'));
	} catch (e) {
		return {
			last_nowplaying,
			cached_lastfm,
			cached,
			error: e,
		};
	} finally {
		if (!last_nowplaying) {
			last_nowplaying = Date.now();
			await env.CACHE.put('last_nowplaying', last_nowplaying);
		}
		if (!cached_lastfm) {
			cached_lastfm = {};
			await env.CACHE.put('cached_lastfm', JSON.stringify(cached_lastfm));
		}
	}

	if (Date.now() - last_nowplaying > 30_000) {
		// 30 seconds of cache
		cached = false;
		const response = await fetch(
			`http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${env.LASTFM_USER}&api_key=${env.LASTFM_API_KEY}&format=json`
		);
		const { recenttracks } = await response.json();
		if (typeof recenttracks !== 'object') {
			return {
				last_nowplaying,
				cached_lastfm,
				cached,
			};
		}
		cached_lastfm = recenttracks.track[0];
		await env.CACHE.put('cached_lastfm', JSON.stringify(cached_lastfm));
		await env.CACHE.put('last_nowplaying', Date.now());
	} else {
		cached = true;
	}

	return {
		last_nowplaying,
		cached_lastfm,
		cached,
	};
};

const getNowPlayingSVG = async (request, env) => {
	let cached_lastfm: any = (await getNowPlaying(request, env)).cached_lastfm;
	let track = {
		image: cached_lastfm.image[3]['#text'] || 'https://via.placeholder.com/300',
		name: cached_lastfm.name || 'N/a',
		artist: cached_lastfm.artist['#text'] || 'Unknown',
	};

	if (track.name.length > 24) {
		track.name = track.name.substring(0, 24) + '...';
	}
	if (track.artist.length > 24) {
		track.artist = track.artist.substring(0, 24) + '...';
	}

	const theme_default: Theme = {
		background: '11111B',
		title: 'CDD6F4',
		subtitle: 'A6ADC8',
		rounded: '8',
		font: 'IBM Plex Sans',
	};

	// from request params
	const { searchParams } = new URL(request.url);

	const theme: Theme = {
		background: searchParams.get('background') || theme_default.background,
		title: searchParams.get('title') || theme_default.title,
		subtitle: searchParams.get('subtitle') || theme_default.subtitle,
		rounded: searchParams.get('rounded') || theme_default.rounded,
		font: searchParams.get('font') || theme_default.font,
	};

	// const image = await fetch(track.image);
	// const image_base64 = Buffer.from(await image.arrayBuffer()).toString('base64');

	const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="100" fill="#${theme.background}" viewBox="0 0 500 100">
    <defs>
        <clipPath id="a">
            <rect width="71" height="71" x="414.5" y="14.5" rx="8"/>
        </clipPath>
    </defs>
	<style>
	@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;600');
	</style>
    <path d="M0 0h500v100H0z"/>
    <image width="71" height="71" x="414.5" y="14.5" clip-path="url(#a)" href="${track.image}"/>
    <text x="26.694" y="44.737" fill="#${theme.title}" font-family="${theme.font}" font-size="24" font-weight="600">
        <tspan x="26.694" y="44.737">${track.name}</tspan>
    </text>
    <text x="26.609" y="72.447" fill="#${theme.subtitle}" font-family="${theme.font}" font-size="24" font-weight="300">
        <tspan x="26.609" y="72.447">${track.artist}</tspan>
    </text>
</svg>`;

	return svg;
};
