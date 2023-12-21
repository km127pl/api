# api.km127pl.us

> [!WARNING]
> This api is unfinished. Keep your expectations low.

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
-   [ ] Implement cached ratelimiter on routes (factor out `/nowplaying`'s ratelimiter)

## API Routes

Latest api routes can be seen [here](https://api.km127pl.us/)
No need to document them here, as they are subject to change.
