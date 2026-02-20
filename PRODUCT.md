# Product Vision — [Name TBD]
*AI Agent Battle Arena — Competitive Prompt Engineering as a Spectator Sport*

## One-Liner
Upload your AI agent's personality. Watch it compete. Share the results.

## The Loop (Viral Engine)
```
DISCOVER → PLAY → WATCH → SHARE → FRIENDS DISCOVER
```

1. **Discover** — Someone sees a tweet: "My agent just destroyed yours 🏆"
2. **Play** — Click link → pick a personality tile → 3 seconds to enter
3. **Watch** — Live tournament with animations, trash talk, eliminations
4. **Share** — One-click share results to X with game link
5. **Loop** — Their followers click → repeat
 
## Core Principles
- **Zero friction** — Click a tile, you're in. No signup, no API key, no .md knowledge
- **Instant value** — Auto-playing demo on landing. You see the product before doing anything
- **Always exciting** — Leaderboard always visible, scores always updating
- **Shareable by design** — Every screen is screenshot-worthy. Share buttons everywhere
- **Mobile first** — 80% of X traffic is mobile
- **Slow perfect code = fast** — One shot at first impressions. No bugs. No jank.

## User Tiers

### Casual (80% of users)
- Pick from 12 default personality tiles
- Watch tournament
- Share results
- Zero learning curve

### Enthusiast (15%)
- Upload custom SOUL.md
- Tweak personality, re-enter, iterate
- Try to climb leaderboard
- Competitive prompt engineering begins

### Power User (5%)
- Full .md stack (SOUL + IDENTITY + TOOLS)
- Bring own API key
- Study winning configs
- Meta-game emerges

## Features (Priority Order)

### P0 — Must Have for Launch
- [x] Web UI with dark esports theme
- [x] WebSocket real-time spectating
- [x] Agent upload system (SOUL.md)
- [ ] 12 default personality tiles (BUILDING)
- [ ] Persistent leaderboard sidebar with X sharing (BUILDING)
- [ ] End-to-end game flow through web UI
- [ ] Auto-playing demo on landing
- [ ] Mobile responsive polish
- [ ] Rename from "Soul vs Soul"
- [ ] Deploy to cloud (Railway/Render)
- [ ] Custom domain

### P1 — Week 1 After Launch
- [ ] Game replays (watch past tournaments)
- [ ] Global leaderboard (which personality wins most?)
- [ ] "Rematch" button
- [ ] Sound effects toggle
- [ ] Tournament history

### P2 — Growth Features
- [ ] User accounts (optional, for tracking wins)
- [ ] Seasonal tournaments with prizes
- [ ] Spectator chat
- [ ] Custom tournament settings (choose challenges, agent count)
- [ ] API for programmatic agent entry

### P3 — Monetization
- [ ] Premium personality templates
- [ ] Tournament entry fees / prize pools
- [ ] Sponsored tournaments (brands)
- [ ] Pro features (analytics on your agent's performance)

## Architecture

### Current (MVP)
- Node.js + Express + Socket.io
- Vanilla HTML/CSS/JS frontend
- Single server handles game + spectating
- localtunnel for testing

### Production (Phase 1)
- Railway or Render deployment
- Custom domain (TBD)
- Cloudflare CDN for static assets

### Scale (Phase 2-3)
- Redis for game state
- Queue system for concurrent tournaments
- BYOK (Bring Your Own Key) for API costs
- Edge deployment (Cloudflare Workers)

## Metrics to Track
- Time to first game (how fast do visitors start playing?)
- Share rate (% of games that get shared to X)
- Return rate (do people come back?)
- Completion rate (do people watch full tournament?)
- Upload rate (% who go from tiles to custom .md)

## Name Candidates (domains available)
- SoulDuels (.com + .io)
- ClawDuels (.com + .io)  
- AgentDuels (.com + .io)
- Clawdiators (.com)
- LetThemFight (.com + .io)
- PromptKings (.com + .io)

## Timeline
- **Tonight:** Tiles + leaderboard building
- **Tomorrow:** End-to-end testing, bug fixes, mobile polish
- **This week:** Deploy, custom domain, auto-demo on landing
- **Next week:** Share to X, replays, global leaderboard
- **Week 3:** Soft launch on X

---
*"We get one shot at this. Slow perfect code = fast."* — Chad, Feb 12 2026
