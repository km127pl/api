import { KVNamespace } from '@cloudflare/workers-types';
import { getRandomString } from './utils';

interface Env {
	CACHE: KVNamespace;
}

export const _router_Fetch = async (request, env, ctx) => {
	const { pathname } = new URL(request.url);

	// check if host is domain "api.km127pl.workers.dev"
	if (request.headers.get('host') == 'api.km127pl.workers.dev') {
		return response(request).redirect('https://api.km127pl.us/' + pathname);
	}

	// check if its s.km127pl.us (shortener)
	if (request.headers.get('host') == 's.km127pl.us') {
		console.error(pathname);
		// try {
		const code = pathname.slice(1);
		console.error(code);
		let data = await env.CACHE.get(code);
		throw new Error(data);

		if (!data) {
			return response(request).json({
				message: 'Not found',
				code: 404,
			});
		}

		data = JSON.parse(data);

		return response(request).text(JSON.stringify(data));
		// } catch (e) {
		// 	return response(request).json({
		// 		message: 'Internal Server Error',
		// 		code: 500,
		// 		error: e,
		// 		...e,
		// 	});
		// }
	}

	const route = _ROUTES[pathname];
	const res = response(request);

	if (route) {
		const webRequest: WebRequest = {
			...request,
			url: request.url,
			path: pathname,
			host: new URL(request.url).host,
			proto: new URL(request.url).protocol,
			params: new URLSearchParams(new URL(request.url).search),
		};

		try {
			return await route(webRequest, res, env, ctx);
		} catch (e) {
			return res.json(
				{
					message: `Internal Server Error: ${e.name || ''}`,
					code: 500,
					error: e.message,
				},
				{
					status: 500,
				}
			);
		}
	} else {
		return res.json({
			message: 'Not found',
			code: 404,
		});
	}
};

interface RequestHandler {
	(req: WebRequest, res: WebResponse, env: Env, ctx: any): Promise<Response> | Response;
}

interface WebRequest extends Request {
	url: string;
	path: string;
	host: string;
	proto: string;
	params: URLSearchParams;
}

interface WebResponse {
	json(data: any): Response;
	text(data: string): Response;
	html(data: string): Response;
	proxy(url: string): Promise<Response>;
	redirect(url: string): Response;
	image(data: any): Response;
	svg(data: any): Response;
	url: string;
	path: string;
	host: string;
	proto: string;
}

export const router = {
	async get(path: string, handler: RequestHandler) {
		_ROUTES[path] = handler;
	},
};
const _ROUTES = {};

export const response = (request) => {
	// response#json
	function json(data, options = {}) {
		return new Response(JSON.stringify(data), {
			headers: {
				'content-type': 'application/json;charset=UTF-8',
			},
			...options,
		});
	}

	// response#text
	function text(data, options = {}) {
		return new Response(data, {
			headers: {
				'content-type': 'text/plain;charset=UTF-8',
			},
			...options,
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
		try {
			return fetch(url);
		} catch (e) {
			return new Response(JSON.stringify({ status: 500, statusText: 'Internal Server Error', ...e }), {
				status: 500,
				headers: {
					'content-type': 'application/json;charset=UTF-8',
				},
			});
		}
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
