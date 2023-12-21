interface Env {
	CACHE: KVNamespace;
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

	return {
		json,
		text,
		html,
		proxy,
		redirect,
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

router.get('/nowplaying', async (request, env, ctx) => {
	/*
	based on the code
	let lastCheck = 0;
let cachedLastfm = {};
app.get("/services/nowplaying", (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    if(Date.now() - lastCheck > 7500) {
        lastCheck = Date.now();
        fetch("http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=dimdendev&api_key=meowmeowmeowmeowmeow&format=json ").then(i => i.json()).then(({recenttracks}) => {
            if(typeof recenttracks !== 'object') return res.json(cachedLastfm);
            cachedLastfm = recenttracks.track[0];
            res.json(cachedLastfm);
        })
    } else {
        res.json(cachedLastfm);
    }
});
 */

	const res = response(request);
	let last_nowplaying;
	let cached_lastfm = {};
	let cached = true;

	try {
		last_nowplaying = parseInt(await env.CACHE.get('last_nowplaying'));
		cached_lastfm = JSON.parse(await env.CACHE.get('cached_lastfm'));
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
		if (!cached_lastfm) {
			cached_lastfm = {};
			await env.CACHE.put('cached_lastfm', JSON.stringify(cached_lastfm));
		}
	}

	if (Date.now() - last_nowplaying > 7500) {
		cached = false;
		const response = await fetch(
			`http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=km127pl&api_key=${env.LASTFM_API_KEY}&format=json`
		);
		const { recenttracks } = await response.json();
		if (typeof recenttracks !== 'object') {
			return res.json(cached_lastfm);
		}
		cached_lastfm = recenttracks.track[0];
		await env.CACHE.put('cached_lastfm', JSON.stringify(cached_lastfm));
		await env.CACHE.put('last_nowplaying', Date.now());
		console.log('not cached');
		console.log(cached_lastfm);
	} else {
		cached = true;
		console.log('cached');
	}

	return res.json({
		message: 'Now playing',
		code: 200,
		date: last_nowplaying,
		sent: Date.now(),
		cached,
		nowplaying: cached_lastfm,
	});
});
