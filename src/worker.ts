import { Resvg, initWasm } from '@resvg/resvg-wasm';

//@ts-expect-error - no types
import resvgwasm from './index_bg.wasm' assert { type: 'wasm' };
import { router } from './web';
import { getNowPlaying, getNowPlayingSVG } from './nowplaying';
import { _router_Fetch } from './web';
import { getRandomString } from './utils';

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
			nowplaying_png: {
				method: 'GET',
				path: '/nowplaying.png',
				description: 'Get my current nowplaying track from last.fm as a png',
				params: {
					background: 'string',
					title: 'string',
					subtitle: 'string',
					rounded: 'string',
				},
			},
			random: {
				method: 'GET',
				path: '/random',
				description: 'Get a random value',
				endpoints: {
					uuid: {
						method: 'GET',
						path: '/random/uuid',
						description: 'Get a random uuid',
					},
					number: {
						method: 'GET',
						path: '/random/number',
						params: {
							min: 'number',
							max: 'number',
						},
						description: 'Get a random number between min and max',
					},
					code: {
						method: 'GET',
						path: '/random/code',
						params: {
							length: 'number',
						},
						description: 'Get a random code with the given length',
					},
					color: {
						method: 'GET',
						path: '/random/color',
						description: 'Get a random color',
					},
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

router.get('/random/uuid', async (req, res, env) => {
	const uuid = crypto.randomUUID();

	return res.json({
		uuid,
	});
});

router.get('/random/number', async (req, res, env) => {
	const min = parseInt(req.params.get('min') || '0');
	const max = parseInt(req.params.get('max') || '0');

	if (!min || !max) {
		return res.json({
			message: 'Missing `min` or `max`',
			code: 400,
		});
	}

	const random = Math.floor(Math.random() * (max - min + 1) + min);

	return res.json({
		random,
	});
});

router.get('/random/code', async (req, res, env) => {
	const length = parseInt(req.params.get('length') || '16');

	if (length < 1 || length > 2048) {
		return res.json({
			message: 'Invalid length',
			code: 400,
		});
	}

	return res.json({
		code: getRandomString(length),
	});
});

router.get('/random/color', async (req, res) => {
	const random = Math.floor(Math.random() * 16777215).toString(16);

	return res.json({
		color: `#${random}`,
	});
});

router.get('/shorten', async (req, res, env) => {
	const url = req.params.get('url');
	if (!url) {
		return res.json({
			message: 'Missing url',
			code: 400,
		});
	}

	const response = await fetch(`https://is.gd/create.php?format=json&url=${url}`);
	const data = await response.json();

	return res.json({
		message: 'Shortened url',
		code: 200,
		url: data.shorturl,
	});
});

export default {
	async fetch(request, env, ctx) {
		return await _router_Fetch(request, env, ctx);
	},
};
