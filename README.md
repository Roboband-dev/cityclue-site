# City Clue

Landing page for [cityclue.site](https://cityclue.site).

City Clue is an adult gamified walking tour. The first pack is the Las Vegas Strip. This repository is the static marketing site: one page, no framework, no build step, and no secrets.

## Deploy on Cloudflare Pages

Connect the GitHub repo. Pages will publish the files at the repository root.

1. In the [Cloudflare dashboard](https://dash.cloudflare.com/), go to **Workers & Pages**.
2. Select **Create application** → **Pages** → **Connect to Git** (or **Import an existing Git repository**).
3. Authorize GitHub if asked, then choose **Roboband-dev/cityclue-site**.
4. Production branch: `main`.
5. Framework preset: **None**.
6. Build command: `exit 0`
7. Build output directory: `.`
8. Leave **Root directory** empty (the site lives at the repo root). Do not add environment variables.
9. Save and deploy.

`index.html` is at the top of the output, which is what Pages serves on the project URL. There is no `package.json` and no GitHub Actions workflow. Cloudflare’s Git integration is the deploy.

Cloudflare’s own static-site guide uses `exit 0` as the build command when there is nothing to compile: [Static HTML](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/).

The project name becomes the `*.pages.dev` hostname. `cityclue` yields `cityclue.pages.dev`.

## Custom domain: cityclue.site

`cityclue.site` is an apex domain (no `www`). On Pages, an apex domain has to be a zone on the **same Cloudflare account** as the project.

1. Add `cityclue.site` to that Cloudflare account if it is not there yet, and point the registrar nameservers at the ones Cloudflare shows.
2. Open the Pages project → **Custom domains** → **Set up a domain**.
3. Enter `cityclue.site` and continue. Cloudflare creates the DNS record when the zone is on the account.
4. Wait until the certificate is active, then open `https://cityclue.site`.

Add `www` only if you want it. A subdomain can be a CNAME to `<project>.pages.dev` from any DNS host. The apex cannot, unless the domain is on Cloudflare.

Details: [Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).

Pull requests get preview URLs after the project is connected. Production updates when `main` changes.

## Waitlist

The join form is a placeholder. It checks the address and stores `{ "email", "mode" }` in `localStorage` under `cityclue-waitlist`. Nothing is sent to a server, and the page says so.

To connect a real list, set `data-endpoint` on `#waitlist-form` in `index.html` to a URL that accepts:

```http
POST /your-list
Content-Type: application/json

{"email":"person@example.com"}
```

A `2xx` response shows “You’re on the list”. Any other result shows an error and does not claim the person joined. Add a privacy note next to the form when addresses actually leave the browser.

## Local preview

From the repo root:

```bash
python3 -m http.server 8080
```

Open `http://127.0.0.1:8080`. Root-relative assets (`/styles.css`, fonts) need a local server; opening the file directly will not load them.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Landing page |
| `styles.css` | Layout and theme |
| `main.js` | Waitlist placeholder |
| `404.html` | Missing-page fallback |
| `favicon.svg` | Icon |
| `og.png` | Share image (1200×630) |
| `_headers` | Security headers Pages applies on deploy |
| `robots.txt`, `sitemap.xml` | Search hints for cityclue.site |
| `assets/fonts/` | Fraunces and Outfit (SIL Open Font License) |

No analytics, cookies, or paid APIs.
