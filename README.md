# Lineup Compare

Compare two fantasy football lineups using your Sleeper league's own scoring rules.

Pick any players for Team A and Team B, choose a season and week (or a season total), and the page scores both lineups with your league's real scoring settings. Defenses and kickers are included. The "Share link" button encodes both lineups into the URL so a friend sees the same matchup.

## How it works

- One static page, no build step and no dependencies: `web/index.html`.
- Data comes live from the public [Sleeper API](https://docs.sleeper.com/) (league scoring, player list, weekly stats). No keys needed.
- The player list is cached in `localStorage` for a day. Lineups and preferences are saved there too.
- Share links keep state in the URL hash (`#d=...`), so nothing is sent to a server.

## Deploy

Hosted on private S3 behind CloudFront using [aws-static-site-template](https://github.com/rclegg/aws-static-site-template): plain CloudFormation (`infra/site.yaml`) and a GitHub OIDC role, with no stored keys. Pushing to `main` runs `.github/workflows/deploy.yml`.

## Run locally

Open `web/index.html` in a browser, or `python3 -m http.server -d web`.

## History

Started as `ubiquitous-octo-journey`, which is kept as-is so old GitHub Pages links keep working.
