// Rewrites first-party CSS and JS URLs in HTML to a content-hashed path,
// /a/<hash>/styles.css, so each deploy gets a new URL when the file bytes
// change. Browsers can keep the hashed file for a year. The plain /styles.css
// and /main.js URLs stay no-cache for any HTML that still points at them.
//
// This runs on Cloudflare Pages as-is. The project build command stays
// `exit 0` and the output directory stays `.`. No package.json.

const assetCache = new Map();

function assetAttributePattern() {
  return /(href|src)(\s*=\s*)(["'])(\/[^"'?#]+\.(?:css|js))\3/g;
}

export function isSafeAssetPath(pathname) {
  return (
    typeof pathname === "string" &&
    /^\/[A-Za-z0-9._/-]+\.(?:css|js)$/.test(pathname) &&
    !pathname.split("/").includes("..")
  );
}

export function localAssetPaths(html) {
  const paths = [];
  for (const match of html.matchAll(assetAttributePattern())) {
    const pathname = match[4];
    if (isSafeAssetPath(pathname) && !paths.includes(pathname)) paths.push(pathname);
  }
  return paths;
}

export function rewriteHtml(html, hashFor) {
  return html.replace(assetAttributePattern(), (full, attr, eq, quote, pathname) => {
    if (!isSafeAssetPath(pathname)) return full;
    const hash = hashFor(pathname);
    if (!hash) return full;
    return attr + eq + quote + "/a/" + hash + pathname + quote;
  });
}

export function parseVersionedPath(pathname) {
  const match = /^\/a\/([a-f0-9]{16})(\/[A-Za-z0-9._/-]+\.(?:css|js))$/.exec(pathname);
  if (!match) return null;
  const assetPath = match[2];
  if (!isSafeAssetPath(assetPath)) return null;
  return { hash: match[1], assetPath };
}

export async function shortHash(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const view = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < 8; i++) hex += view[i].toString(16).padStart(2, "0");
  return hex;
}

async function loadAsset(context, pathname) {
  const cached = assetCache.get(pathname);
  if (cached) return cached;
  const assetUrl = new URL(pathname, context.request.url);
  const assetResponse = await context.env.ASSETS.fetch(
    new Request(assetUrl, {
      method: "GET",
      headers: { "x-cityclue-asset": "1" }
    })
  );
  if (!assetResponse.ok) return null;
  const body = await assetResponse.arrayBuffer();
  const entry = {
    hash: await shortHash(body),
    body,
    contentType:
      assetResponse.headers.get("content-type") ||
      (pathname.endsWith(".css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8")
  };
  assetCache.set(pathname, entry);
  return entry;
}

function versionedHeaders(entry) {
  const headers = new Headers();
  headers.set("Content-Type", entry.contentType);
  headers.set("Content-Length", String(entry.body.byteLength));
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("ETag", '"' + entry.hash + '"');
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}

async function serveVersioned(context, versioned) {
  let hit = null;
  try {
    hit = await caches.default.match(context.request);
  } catch (err) {
    hit = null;
  }
  if (hit) return hit;

  const entry = await loadAsset(context, versioned.assetPath);
  if (!entry || entry.hash !== versioned.hash) {
    return new Response("Not found", {
      status: 404,
      headers: {
        "Cache-Control": "no-cache, must-revalidate",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }

  const response = new Response(entry.body, { status: 200, headers: versionedHeaders(entry) });
  try {
    context.waitUntil(caches.default.put(context.request, response.clone()));
  } catch (err) {
    /* The browser still caches this URL from Cache-Control. */
  }
  return response;
}

async function rewriteDocument(context, response) {
  const html = await response.text();
  const paths = localAssetPaths(html);
  const hashes = new Map();
  await Promise.all(
    paths.map(async (pathname) => {
      const entry = await loadAsset(context, pathname);
      if (entry) hashes.set(pathname, entry.hash);
    })
  );
  const rewritten = rewriteHtml(html, (pathname) => hashes.get(pathname) || null);
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-cache, must-revalidate");
  headers.delete("etag");
  headers.delete("content-length");
  headers.delete("content-encoding");
  return new Response(rewritten, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function handle(context) {
  if (context.request.headers.get("x-cityclue-asset") === "1") return context.next();

  const url = new URL(context.request.url);
  const versioned = parseVersionedPath(url.pathname);
  if (versioned) return serveVersioned(context, versioned);

  const response = await context.next();
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return response;
  return rewriteDocument(context, response);
}

export async function onRequest(context) {
  try {
    context.passThroughOnException();
  } catch (err) {
    /* Advanced mode does not support this. The try/catch below still applies. */
  }
  try {
    return await handle(context);
  } catch (err) {
    return context.next();
  }
}
