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

Leave the build command as `exit 0`. CSS and JS versioning does not need a compile step. See [Fresh CSS and JS](#fresh-css-and-js-on-every-deploy).

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
| `/thanks` | Post-purchase note. `noindex`. Does not send a Google Ads purchase. Bokun does not document a redirect to this page. |

## Booking widget

`main.js` loads `BokunWidgetsLoader.js` after first paint (or sooner, if someone reaches a Book button or the price section). The channel is `7cbce2f5-33c8-4d4b-92b2-bec34c99555c`.

`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `gclid`, `gbraid`, `wbraid`, `gclsrc`, `gad_source` and `fbclid` on the page URL are copied onto the widget and button URLs. Nothing on this site strips the landing-page query string. Bokun also reads `gclid` from the page and sends the full page URL as `hostUrl`.

If the loader fails, Book buttons go to the hosted checkout for experience 1326696.

## Analytics

Every page that loads `main.js` loads `https://www.googletagmanager.com/gtm.js?id=GTM-TWJ46LDV` from that file. There is no direct `gtag('config', 'AW-18531609653')` and no `gtag/js?id=AW-18531609653` added by this site. The container is the only config of `AW-18531609653`: its Google tag fires on All Pages, a Conversion Linker fires with it, and the Ads conversion (`18531609653` / `7l5DCO3TjKYdELXYx4RF`) fires only on a dataLayer event named `purchase`. The conversion's order id is `ecommerce.transaction_id`. There is no phone-call conversion.

Bokun's loader checks `script[src^="https://www.googletagmanager.com/gtm.js"]`. When that tag is already present it does not inject its own bootstrap. That bootstrap is an inline script, and `script-src` does not allow `unsafe-inline`, so the inline copy never ran and the iframes were told the parent had already handled tagging. Loading the container from `main.js` is what lets Bokun's setup run.

This page does not send its own purchase conversion. A `BookingConfirmed` message is recorded only as a local `cityclue:track` event. It is not pushed to `dataLayer`, because that would be a second `purchase` for GTM. `/thanks` does not send one either. Bokun does not document a redirect to `/thanks`, and a hit from this page would use the booking id in the query string. GTM's order id is whatever Bokun puts in `ecommerce.transaction_id`. The receipt screen's own transaction object uses the confirmation code as `id`. Those strings are not the same, so Google Ads would not treat them as one booking ([transaction id deduplication](https://support.google.com/google-ads/answer/6386790)).

Opening a Book button, the booking modal, or an `AddingToCart` message pushes one `{event: "begin_checkout", currency: "USD"}` onto `dataLayer`. The published container has no tag on that event, so it is not sent to Google Ads and it is not a purchase. The Ads conversion tag fires only when the event name is `purchase`.

Bokun still has to send the `purchase` event. In the extranet that is already set: Settings → Sales Settings → Booking channel → `7cbce2f5-33c8-4d4b-92b2-bec34c99555c` → Tracking, with Google Tag Manager `GTM-TWJ46LDV` and Google Ads `AW-18531609653` / `7l5DCO3TjKYdELXYx4RF`, and the container published. An iframed checkout forwards dataLayer objects to this page as `GaEvent`, and Bokun's parent listener pushes them onto this page's `dataLayer`. A top-level tab on `bookings.bokun.io` is its own window, so it loads this same container itself and the purchase stays on that origin.

`_headers` allows the Google tag hosts (`googletagmanager.com`, `google-analytics.com`, `googleadservices.com`, `doubleclick.net`, `google.com`) on `script-src`, `img-src`, `connect-src`, and `frame-src` as Google's tag CSP lists them. `script-src` still does not allow `unsafe-inline` or `unsafe-eval`. Fonts stay self-hosted.

Button, question, map, support, scroll, widget and purchase signals still dispatch a `cityclue:track` event. They are forwarded to `plausible` when that global exists. They are not copied into the Google tag's `dataLayer`.

`_headers` also allows Cloudflare Web Analytics (`static.cloudflareinsights.com` and `cloudflareinsights.com`). Turn the beacon on in the Cloudflare dashboard. This site does not embed a token, and it does not load Meta or TikTok pixels.

## Fresh CSS and JS on every deploy

`functions/_middleware.js` runs when Pages serves a document. It hashes each root-relative `.css` and `.js` file the HTML points at (today `/styles.css` and `/main.js`) and rewrites those URLs to `/a/<hash>/styles.css` and `/a/<hash>/main.js`. The hash is the first 16 hex characters of SHA-256 of the file bytes, so a deploy that changes either file changes its URL. Fonts, images, the Bokun loader, and `gtm.js` are not rewritten.

Hashed responses are `Cache-Control: public, max-age=31536000, immutable`. HTML routes are `no-cache, must-revalidate`, so the next visit sees the new URLs. `/styles.css` and `/main.js` themselves are also `no-cache, must-revalidate`. Those plain URLs are what a browser still holding an older document will request, and what the page uses if the Function does not run.

`_routes.json` keeps images, fonts, icons, and the plain CSS and JS files off the Function. Nothing in the Cloudflare dashboard has to change: framework preset **None**, build command `exit 0`, build output directory `.`.

If **Settings → Runtime → Fail open / closed** is fail open (the usual setting), a Functions quota miss still serves the site. Documents and the plain CSS and JS URLs revalidate instead of using the hashed URL. Leave it fail open.

## Local preview

From the repo root:

```bash
python3 -m http.server 8080
```

Open `http://127.0.0.1:8080`. Root-relative assets (`/styles.css`, fonts) need a local server; opening the file directly will not load them.

`python3 -m http.server` does not apply `_headers` and does not run `functions/_middleware.js`. Local documents still request `/styles.css` and `/main.js`. Cloudflare Pages does both.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Landing page |
| `terms.html`, `privacy.html`, `cancellation.html`, `support.html`, `thanks.html` | Policy and support pages |
| `styles.css` | Design tokens, Bricolage Grotesque + Outfit, section layout |
| `main.js` | Booking widget, sticky bar, questions, GTM container load |
| `404.html` | Missing-page fallback |
| `favicon.svg`, `favicon.ico`, `site.webmanifest` | Icon set at the site root |
| `img/` | Hero, OG (`img/og/og-1200x630.jpg`), logos, mockups, route, Bruce, icons |
| `img/lifestyle/` | Responsive lifestyle photos (WebP 480/768/1080 and a 1280 JPG) |
| `_headers` | Security headers and cache lifetimes Pages applies on deploy |
| `functions/_middleware.js` | Content-hashed CSS and JS URLs in HTML |
| `_routes.json` | Which requests invoke that Function |
| `robots.txt`, `sitemap.xml` | Search hints for cityclue.site |
| `assets/fonts/` | Self-hosted Bricolage Grotesque and Outfit (SIL Open Font License) |

Fonts stay on this origin. `font-src` is `'self'` only, with no Google Fonts hosts.

The illustrated hero is the default. Add `is-photo` to the hero section to crop in `img/lifestyle/hero-group-*` instead. High-five sits in How it works, couple-bridge in Route & logistics, and phone-closeup next to booking. Those photos use `srcset` and `loading="lazy"`. The route SVG is inlined so the page fonts apply. Schema `Product.image` is `/img/hero/hero-desktop-1440.jpg`.
