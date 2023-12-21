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

router.get('/api', (request, env, ctx) => {
	const res = response(request);
	return res.json({
		message: 'Hello world',
		code: 200,
		endpoints: {
			echo: {
				method: 'GET',
				path: '/api/echo',
				params: {
					message: 'string',
				},
				description: 'Echo back the message',
			},
			proxy: {
				method: 'GET',
				path: '/api/proxy',
				params: {
					url: 'string',
				},
				description: 'Proxy the request to the given url',
			},
			stats: {
				method: 'GET',
				path: '/api/stats',
				description: 'Get stats',
			},
		},
	});
});

router.get('/api/', (request, env, ctx) => {
	return response(request).redirect('/api');
});

router.get('/api/proxy', (request, env, ctx) => {
	const res = response(request);
	const { searchParams } = new URL(request.url);
	const url = searchParams.get('url');
	return res.proxy(url);
});

router.get('/api/stats', async (request, env, ctx) => {
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

router.get('/api/echo', (request, env, ctx) => {
	const res = response(request);
	const { searchParams } = new URL(request.url);
	const message = searchParams.get('message');
	return res.json({
		message,
		code: 200,
	});
});
