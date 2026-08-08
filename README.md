<img style="width: 128px; height: 128px" src="website/static/favicon.svg" /><h1 style="font-size: 48px">Rugplay v2</h1>

**A ground-up rework of [Rugplay](https://rugplay.com), the fake crypto trading simulator.**

[Original project](https://github.com/outpoot/rugplay) | [License](LICENSE)

## About

Rugplay v2 is an in-development fork of [outpoot/rugplay](https://github.com/outpoot/rugplay), a realistic cryptocurrency trading simulator that lets you experience the mechanics of decentralized exchanges, liquidity pools, and "rug pulls" without any real money involved.

This fork takes the original project as a foundation and builds on top of it: new systems, new features, and ongoing rewrites of existing ones. It's a personal, self-directed project and is under active, sometimes rapid, development — expect things to move fast and occasionally break.

## What's different from upstream

This isn't just a re-skin. Notable additions and changes on top of the original Rugplay:

- 📰 **AI-powered news feed** — a full news pipeline that turns market events (trades, coin launches, prediction market resolutions, rug pulls, etc.) into written articles. Each event is first sent to an AI writer; if that's unavailable or fails validation, a deterministic template writer generates the article instead, so the feed never breaks. Articles get an automatically picked cover image (coin icon, user avatar, or themed stock photo), can be reacted to, reported, and shared, and are ranked for the main feed.
- 🎲 **Expanded arcade** — the existing arcade game suite (Coinflip, Dice, Slots, Tower, Mines) continues to grow, with new games built on the same server-authoritative RNG and house-edge conventions as the rest of the arcade.
- ☁️ **Vercel-ready deployment** — added the Vercel adapter alongside the existing Docker/Node deployment path.
- 🔧 Various under-the-hood rewrites across the AMM engine, database schema, job scheduler, and websocket layer as the project evolves.

Since this is a living fork, this list will drift out of date — the code is the source of truth.

## Core features (from upstream)

- 🪙 Create coins
- 🟢 Buy coins
- 🔴 Sell coins
- ⚖️ Predict on questions (similar to Polymarket)
- 🎲 Play arcade games
- 📰 AI-generated news feed
- 📊 View a Treemap graph of the entire market
- 🏆 Compete on leaderboards

![Preview 2](github_assets/preview2.png)
![Preview](github_assets/preview.png)

## Tech stack

- **Frontend/Backend:** SvelteKit + TypeScript
- **Database:** PostgreSQL (via Drizzle ORM)
- **Cache/Pub-Sub:** Redis
- **Realtime:** standalone Bun websocket server
- **Storage:** S3-compatible (Backblaze B2)
- **Payments:** Polar.sh
- **AI:** OpenRouter

## Status

This is a personal, in-progress fork — not a stable release, and not affiliated with or endorsed by the original Rugplay team. If you're looking for the stable, upstream version, go to [outpoot/rugplay](https://github.com/outpoot/rugplay) or [rugplay.com](https://rugplay.com).

## License

This project is licensed under the **Creative Commons Attribution-NonCommercial 4.0 International** License (**CC BY-NC 4.0**), inherited from the upstream project. See the [LICENSE](LICENSE) file for details.
