# City Clue

Landing page for [cityclue.site](https://cityclue.site).

City Clue is a self-guided walking game for adults 21+ on the Las Vegas Strip, made by Rift Studios (a DBA of Arcade of Satoshi LLC). The brand name is two words. The domain stays `cityclue.site`. This repository is the static marketing site: HTML, CSS and JS, no framework, no build step, and no secrets.

Bookings run through the Bokun widget for experience #1326696 ($14.99 per player, Stripe, USD). The inline calendar sits in the price section. Book buttons open the Bokun checkout. On desktop (900px and up) the hero button smooth-scrolls to `#book` instead.

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

## Pages

| Path | Purpose |
| --- | --- |
| `/` | Landing page and booking |
| `/terms` | Terms of sale and assumption of risk |
| `/privacy` | Privacy, including Bokun and Stripe |
| `/cancellation` | 24-hour cancellation policy |
| `/support` | support@riftstudios.ai |
| `/thanks` | Post-purchase note. Point Bokun's redirect here if the channel supports one. `noindex`. |

## Booking widget

`main.js` loads `BokunWidgetsLoader.js` after first paint (or sooner, if someone reaches a Book button or the price section). The channel is `7cbce2f5-33c8-4d4b-92b2-bec34c99555c`.

`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `gclid` and `fbclid` on the page URL are copied onto the widget and button URLs. Bokun also reads `gclid` from the page and sends the full page URL as `hostUrl`.

If the loader fails, Book buttons go to the hosted checkout for experience 1326696.

## Analytics

`_headers` allows Cloudflare Web Analytics (`static.cloudflareinsights.com` and `cloudflareinsights.com`). Turn the beacon on in the Cloudflare dashboard. This site does not embed a token, and it does not load Google, Meta or TikTok pixels.

Button, question, map, support, scroll, widget and purchase signals dispatch a `cityclue:track` event. They are forwarded to `plausible` or `dataLayer` only when those globals already exist. A confirmed Bokun `BookingConfirmed` message is recorded as `purchase` without the booking reference.

## Local preview

From the repo root:

```bash
python3 -m http.server 8080
```

Open `http://127.0.0.1:8080`. Root-relative assets (`/styles.css`, fonts) need a local server; opening the file directly will not load them.

`python3 -m http.server` does not apply `_headers`. Cloudflare Pages does.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Landing page |
| `terms.html`, `privacy.html`, `cancellation.html`, `support.html`, `thanks.html` | Policy and support pages |
| `styles.css` | Design tokens, Bricolage Grotesque + Outfit, section layout |
| `main.js` | Booking widget, sticky bar, questions, event signals |
| `404.html` | Missing-page fallback |
| `favicon.svg`, `favicon.ico`, `site.webmanifest` | Icon set at the site root |
| `img/` | Hero, OG (`img/og/og-1200x630.jpg`), logos, mockups, route, Bruce, icons |
| `img/lifestyle/` | Responsive lifestyle photos (WebP 480/768/1080 and a 1280 JPG) |
| `_headers` | Security headers Pages applies on deploy |
| `robots.txt`, `sitemap.xml` | Search hints for cityclue.site |
| `assets/fonts/` | Self-hosted Bricolage Grotesque and Outfit (SIL Open Font License) |

Fonts stay on this origin. `font-src` is `'self'` only, with no Google Fonts hosts.

The illustrated hero is the default. Add `is-photo` to the hero section to crop in `img/lifestyle/hero-group-*` instead. High-five sits in How it works, couple-bridge in Route & logistics, and phone-closeup next to booking. Those photos use `srcset` and `loading="lazy"`. The route SVG is inlined so the page fonts apply. Schema `Product.image` is `/img/hero/hero-desktop-1440.jpg`.
