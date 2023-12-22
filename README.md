# api.km127pl.us

> [!NOTE]
> This api is subject to change at any time. I am not responsible for any breakages.

> [!WARNING]
> This api is unfinished. Keep your expectations low. It also shades the @resvg/resvg-wasm package, which adds 1.5mb to the bundle size.

my very weird API running on cloudflare workers

## Usage

well, idk why you would want to use this, but if you do, here's how:
note: you need to have a cloudflare account

```sh
# clone the repo
git clone
# install dependencies
npm i
# login to wrangler
wrangler login
# publish to cloudflare
wrangler publish
# deploy to cloudflare
wrangler deploy
```

## Todo

-   [ ] Url Shortener
-   [x] Last.FM Now Playing
-   [x] Last.FM Now Playing as SVG
-   [ ] Last.FM Now Playing as PNG
-   [ ] Last.FM Now Playing variable width
-   [ ] Implement cached ratelimiter on routes (factor out `/nowplaying`'s ratelimiter)

## API Routes

Latest api routes can be seen [here](https://api.km127pl.us/)
No need to document them here, as they are subject to change.
