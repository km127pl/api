const getNowPlaying = async (req, env) => {
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

const getNowPlayingSVG = async (req, env) => {
	let cached_lastfm: any = (await getNowPlaying(req, env)).cached_lastfm;
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
	const theme: Theme = {
		background: req.params.get('background') || theme_default.background,
		title: req.params.get('title') || theme_default.title,
		subtitle: req.params.get('subtitle') || theme_default.subtitle,
		rounded: req.params.get('rounded') || theme_default.rounded,
		font: req.params.get('font') || theme_default.font,
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

export { getNowPlaying, getNowPlayingSVG };
