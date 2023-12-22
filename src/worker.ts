import { Resvg, initWasm } from '@resvg/resvg-wasm';

//@ts-expect-error - no types
import resvgwasm from './index_bg.wasm' assert { type: 'wasm' };
import { router } from './web';
import { getNowPlaying, getNowPlayingSVG } from './nowplaying';
import { _router_Fetch } from './web';

initWasm(resvgwasm as WebAssembly.Module);

router.get('/', async (req, res) => {
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

router.get('/proxy', async (req, res) => {
	const url = req.params.get('url');

	if (!url) {
		return res.json({
			message: 'Missing url',
			code: 400,
		});
	}
	return res.proxy(url);
});

router.get('/stats', async (req, res, env, ctx) => {
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

router.get('/echo', (req, res) => {
	return res.json({
		message: req.params.get('message') || 'Hello world',
		code: 200,
	});
});

router.get('/nowplaying.svg', async (req, res, env) => res.svg(await getNowPlayingSVG(req, env)));

router.get('/nowplaying.png', async (req, res, env) => {
	const svg = await getNowPlayingSVG(req, env);

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

router.get('/nowplaying', async (req, res, env, ctx) => {
	// based on the code sent by dimden on their discord server, ty <3
	// https://discord.com/channels/503244758966337546/628124693378891786/1187192265026838591
	// join it! https://discord.gg/yaqzbDBaAA
	const { last_nowplaying, cached_lastfm, cached } = await getNowPlaying(req, env);

	return res.json({
		message: 'Now playing',
		code: 200,
		date: last_nowplaying,
		sent: Date.now(),
		cached,
		nowplaying: cached_lastfm,
	});
});

export default {
	async fetch(request, env, ctx) {
		return await _router_Fetch(request, env, ctx);
	},
};
