(function () {
  var CHANNEL = "7cbce2f5-33c8-4d4b-92b2-bec34c99555c";
  var LOADER = "https://widgets.bokun.io/assets/javascripts/apps/build/BokunWidgetsLoader.js?bookingChannelUUID=" + CHANNEL;
  var HOSTED = "https://widgets.bokun.io/online-sales/" + CHANNEL + "/experience/1326696";

  // Google Ads purchase conversion. These are public tag ids.
  // GTM-TWJ46LDV is the container Bokun's checkout loads. It is not loaded here.
  // A purchase on this page uses the Bokun booking id as transaction_id so Google
  // Ads can drop a second hit for the same conversion action. While either value
  // is still a placeholder, gtag.js is not loaded.
  var GADS_ID = "AW-18531609653";
  var GADS_PURCHASE_LABEL = "7l5DCO3TjKYdELXYx4RF";

  var TRACK_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "gbraid", "wbraid", "gclsrc", "gad_source", "fbclid"];
  var PURCHASE_KEY = "cityclue:gads-purchase:";
  var claimedPurchases = Object.create(null);
  var purchaseSentOnPage = false;
  var allowConversion = false;
  var gtagInstalled = false;
  var checkoutBegan = false;
  var pendingEmail = "";

  function track(name, props) {
    var detail = { event: name };
    if (props) {
      Object.keys(props).forEach(function (key) {
        detail[key] = props[key];
      });
    }
    try {
      window.dispatchEvent(new CustomEvent("cityclue:track", { detail: detail }));
    } catch (err) {
      /* CustomEvent can throw if the name is bad. Tracking must not break booking. */
    }
    if (typeof window.plausible === "function") {
      try {
        window.plausible(name, { props: props || {} });
      } catch (err) {}
    }
    // Once this page owns dataLayer for gtag, keep scroll and click signals
    // out of it. Those objects would otherwise be read as Google events.
    if (Array.isArray(window.dataLayer) && !gtagInstalled) {
      window.dataLayer.push(detail);
    }
  }

  window.cityclueTrack = track;

  function adsConfigured() {
    if (!/^AW-\d{6,}$/.test(GADS_ID)) return false;
    if (!GADS_PURCHASE_LABEL || GADS_PURCHASE_LABEL === "LABEL") return false;
    if (!/^[A-Za-z0-9_-]{8,}$/.test(GADS_PURCHASE_LABEL)) return false;
    return true;
  }

  function installGtag() {
    if (!adsConfigured() || gtagInstalled) return;
    gtagInstalled = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      // Bokun can forward a conversion into this page. Only sendPurchase may
      // emit the purchase conversion, and only once per page view.
      if (arguments[0] === "event" && arguments[1] === "conversion") {
        if (!allowConversion) return;
        allowConversion = false;
      }
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("set", "linker", {
      domains: ["cityclue.site", "bokun.io"],
      accept_incoming: true
    });
    window.gtag("config", GADS_ID, {
      allow_enhanced_conversions: true,
      linker: {
        domains: ["cityclue.site", "bokun.io"],
        accept_incoming: true
      }
    });
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GADS_ID);
    document.head.appendChild(script);
  }

  function money(text) {
    if (typeof text === "number" && isFinite(text)) return Math.round(text * 100) / 100;
    var cleaned = String(text == null ? "" : text).replace(/,/g, "");
    var match = cleaned.match(/(\d+\.\d{2})/);
    if (!match) return null;
    return Number(match[1]);
  }

  function cleanEmail(value) {
    if (typeof value !== "string") return "";
    var email = value.trim();
    if (email.length > 200 || email.indexOf(" ") !== -1 || email.indexOf("@") < 1) return "";
    return email;
  }

  function bookingEmail(booking) {
    if (!booking || typeof booking !== "object") return "";
    var keys = ["email", "customerEmail", "contactEmail", "emailAddress"];
    for (var i = 0; i < keys.length; i++) {
      var email = cleanEmail(booking[keys[i]]);
      if (email) return email;
    }
    return "";
  }

  function purchaseSeen(id) {
    var key = PURCHASE_KEY + id;
    if (claimedPurchases[key]) return true;
    try {
      return window.localStorage.getItem(key) === "1";
    } catch (err) {
      return false;
    }
  }

  function claimPurchase(id) {
    var key = PURCHASE_KEY + id;
    claimedPurchases[key] = true;
    try {
      window.localStorage.setItem(key, "1");
    } catch (err) {}
  }

  function sendPurchase(id, value, email) {
    if (!adsConfigured() || typeof window.gtag !== "function") return false;
    if (id == null || id === "") return false;
    var transactionId = String(id);
    if (purchaseSentOnPage || purchaseSeen(transactionId)) return false;
    purchaseSentOnPage = true;
    claimPurchase(transactionId);
    var userEmail = cleanEmail(email) || pendingEmail;
    if (userEmail) {
      window.gtag("set", "user_data", { email: userEmail });
    }
    var payload = {
      send_to: GADS_ID + "/" + GADS_PURCHASE_LABEL,
      currency: "USD",
      transaction_id: transactionId
    };
    if (typeof value === "number" && isFinite(value)) payload.value = value;
    allowConversion = true;
    window.gtag("event", "conversion", payload);
    return true;
  }

  function beginCheckout(source) {
    if (checkoutBegan) return;
    checkoutBegan = true;
    track("begin_checkout", { source: source });
    if (!adsConfigured() || typeof window.gtag !== "function") return;
    window.gtag("event", "begin_checkout", { currency: "USD" });
  }

  function withTracking(url) {
    var incoming = new URLSearchParams(window.location.search);
    var next;
    try {
      next = new URL(url);
    } catch (err) {
      return url;
    }
    TRACK_KEYS.forEach(function (key) {
      var value = incoming.get(key);
      if (value && !next.searchParams.has(key)) next.searchParams.set(key, value);
    });
    return next.toString();
  }

  function prepareWidgetUrls() {
    document.querySelectorAll(".bokunWidget[data-src], a.bokunButton[href]").forEach(function (el) {
      if (el.classList.contains("bokunWidget")) {
        el.setAttribute("data-src", withTracking(el.getAttribute("data-src")));
      } else {
        el.setAttribute("href", withTracking(el.getAttribute("href")));
      }
    });
  }

  var loaderStarted = false;
  var loaderFailed = false;
  function loadBokun() {
    if (loaderStarted) return;
    if (!document.querySelector(".bokunWidget, .bokunButton")) return;
    loaderStarted = true;
    prepareWidgetUrls();
    var script = document.createElement("script");
    script.src = LOADER;
    script.async = true;
    script.defer = true;
    script.addEventListener("error", function () {
      loaderFailed = true;
    });
    document.body.appendChild(script);
  }

  function scheduleBokun() {
    if (!document.querySelector(".bokunWidget, .bokunButton")) return;
    var started = false;
    function go() {
      if (started) return;
      started = true;
      loadBokun();
    }
    document.querySelectorAll(".bokunButton, #book").forEach(function (el) {
      el.addEventListener("pointerenter", go, { once: true, passive: true });
      el.addEventListener("pointerdown", go, { once: true, passive: true });
      el.addEventListener("focusin", go, { once: true });
    });
    var book = document.getElementById("book");
    if (book && "IntersectionObserver" in window) {
      var watcher = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            go();
            watcher.disconnect();
          }
        });
      }, { rootMargin: "600px 0px" });
      watcher.observe(book);
    }
    var idle = window.requestIdleCallback || function (cb) { return setTimeout(cb, 1200); };
    if (document.readyState === "complete") {
      idle(go, { timeout: 1800 });
    } else {
      window.addEventListener("load", function () {
        idle(go, { timeout: 1800 });
      }, { once: true });
    }
  }

  window.addEventListener("click", function (event) {
    var node = event.target;
    var heroLink = node && node.closest ? node.closest("[data-cta='hero']") : null;
    if (!heroLink || !window.matchMedia("(min-width: 900px)").matches) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.isTrusted) track("cta_click", { location: "hero" });
    var bookTarget = document.getElementById("book");
    if (!bookTarget) return;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bookTarget.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }, true);

  var heroBook = document.querySelector("[data-cta='hero']");
  if (heroBook) {
    heroBook.addEventListener("click", function (event) {
      if (window.matchMedia("(min-width: 900px)").matches) return;
      if (event.isTrusted) track("cta_click", { location: "hero" });
      var opener = document.querySelector("a.bokunButton");
      if (!opener) return;
      event.preventDefault();
      opener.click();
    });
  }

  document.querySelectorAll("a.bokunButton").forEach(function (el) {
    el.addEventListener("click", function (event) {
      beginCheckout("book");
      if (event.isTrusted) track("cta_click", { location: el.getAttribute("data-cta") || "book" });
      if (el.getAttribute("data-bokun-widget-loaded") === "true") return;
      if (loaderFailed) return;
      event.preventDefault();
      if (el.getAttribute("data-booking-wait") === "true") return;
      el.setAttribute("data-booking-wait", "true");
      loadBokun();
      var tries = 0;
      var timer = window.setInterval(function () {
        tries += 1;
        if (el.getAttribute("data-bokun-widget-loaded") === "true") {
          window.clearInterval(timer);
          el.removeAttribute("data-booking-wait");
          el.click();
        } else if (loaderFailed || tries > 40) {
          window.clearInterval(timer);
          el.removeAttribute("data-booking-wait");
          window.location.assign(el.href);
        }
      }, 100);
    });
  });

  var priceTracked = false;
  var widget = document.querySelector("#book .bokunWidget");
  if (widget) {
    widget.addEventListener("pointerdown", function () {
      if (priceTracked) return;
      priceTracked = true;
      track("cta_click", { location: "price" });
    });
  }

  document.querySelectorAll(".faq-item button").forEach(function (button) {
    button.addEventListener("click", function () {
      var open = button.getAttribute("aria-expanded") === "true";
      var panel = document.getElementById(button.getAttribute("aria-controls"));
      button.setAttribute("aria-expanded", open ? "false" : "true");
      if (panel) panel.hidden = open;
      if (!open) {
        var label = button.querySelector("span");
        track("faq_open", { question: (label ? label.textContent : button.textContent).trim() });
      }
    });
  });

  document.querySelectorAll("[data-track]").forEach(function (el) {
    el.addEventListener("click", function () {
      var name = el.getAttribute("data-track");
      if (name) track(name, {});
    });
  });

  var sticky = document.querySelector(".bookbar");
  var header = document.querySelector(".site-header");
  var heroCta = document.querySelector("[data-cta='hero']");
  var book = document.getElementById("book");
  var heroOut = false;
  var bookVisible = false;
  var modalOpen = false;
  var modalWasOpen = false;
  var desktopQuery = window.matchMedia("(min-width: 769px)");

  function modalIsOpen() {
    var el = document.getElementById("bokun-modal-container") || document.getElementById("bokun-modal-iFrame");
    if (!el) return false;
    var style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    var box = el.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  }

  function updateSticky() {
    if (!sticky) return;
    var show = !desktopQuery.matches && heroOut && !bookVisible && !modalOpen;
    sticky.classList.toggle("is-visible", show);
    if (show) sticky.removeAttribute("inert");
    else sticky.setAttribute("inert", "");
  }

  if (heroCta && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      heroOut = !entries[0].isIntersecting;
      updateSticky();
    }, { threshold: 0 }).observe(heroCta);
  }

  if (book && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      bookVisible = entries[0].isIntersecting;
      updateSticky();
    }, { threshold: 0.12 }).observe(book);
  }

  if (typeof desktopQuery.addEventListener === "function") {
    desktopQuery.addEventListener("change", updateSticky);
  } else if (typeof desktopQuery.addListener === "function") {
    desktopQuery.addListener(updateSticky);
  }

  function syncModal() {
    modalOpen = modalIsOpen();
    if (modalOpen && !modalWasOpen) {
      track("widget_open", {});
      beginCheckout("widget");
    }
    modalWasOpen = modalOpen;
    updateSticky();
  }

  if (document.body && "MutationObserver" in window) {
    new MutationObserver(syncModal).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden", "aria-hidden"]
    });
  }

  var depths = { 25: false, 50: false, 75: false, 100: false };
  var scrollTicking = false;
  function onScroll() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    if (max <= 0) return;
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
    var percent = (window.scrollY / max) * 100;
    [25, 50, 75, 100].forEach(function (mark) {
      if (!depths[mark] && percent >= mark - 0.5) {
        depths[mark] = true;
        track("scroll_depth", { percent: String(mark) });
      }
    });
  }
  window.addEventListener("scroll", function () {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(function () {
      scrollTicking = false;
      onScroll();
    });
  }, { passive: true });

  function isBokunOrigin(origin) {
    try {
      var host = new URL(origin).hostname;
      return host === "bokun.io" || host.slice(-9) === ".bokun.io";
    } catch (err) {
      return false;
    }
  }

  function readMessage(data) {
    if (!data) return null;
    if (typeof data === "object" && data.messageType) return data;
    if (typeof data !== "string") return null;
    var start = data.indexOf("{");
    if (start === -1) return null;
    try {
      return JSON.parse(data.slice(start));
    } catch (err) {
      return null;
    }
  }

  function noteUserData(args) {
    if (!Array.isArray(args) || args[0] !== "set" || args[1] !== "user_data") return false;
    var email = cleanEmail(args[2] && args[2].email);
    if (email) pendingEmail = email;
    return true;
  }

  function handleBokunMessage(origin, data) {
    if (!isBokunOrigin(origin)) return;
    var message = readMessage(data);
    if (!message || !message.messageType) return;
    if (message.messageType === "AddingToCart") {
      track("checkout_start", {});
      beginCheckout("cart");
    }
    if (message.messageType === "BookingConfirmed") {
      var booking = message.booking || {};
      var status = booking.status;
      var purchase = { currency: "USD" };
      if (status) purchase.status = status;
      var value = money(booking.totalText);
      if (value != null) purchase.value = value;
      if (booking.bookingId != null && booking.bookingId !== "") purchase.transaction_id = String(booking.bookingId);
      track("purchase", purchase);
      if ((status === "CONFIRMED" || status === "REQUESTED") && purchase.transaction_id) {
        sendPurchase(purchase.transaction_id, value, bookingEmail(booking));
      }
    }
    if (message.messageType === "GaEvent") {
      if (noteUserData(message.args)) return;
      if (Array.isArray(message.args) && message.args[0] === "event" && message.args[1] === "begin_checkout") {
        beginCheckout("bokun");
      }
      // A forwarded purchase is not sent again from here. BookingConfirmed
      // is the purchase for this page, and its transaction_id is the booking id.
    }
  }

  window.addEventListener("message", function (event) {
    handleBokunMessage(event.origin, event.data);
  });

  window.cityclueAds = {
    configured: adsConfigured,
    handleBokunMessage: handleBokunMessage,
    beginCheckout: beginCheckout
  };

  var fallback = document.getElementById("book-fallback");
  if (widget && fallback) {
    window.setTimeout(function () {
      if (!widget.querySelector("iframe")) fallback.hidden = false;
    }, 12000);
  }

  installGtag();

  if (document.body.getAttribute("data-page") === "thanks") {
    var params = new URLSearchParams(window.location.search);
    var thanks = { currency: "USD" };
    var valueParam = params.get("value") || params.get("total");
    if (valueParam) thanks.value = valueParam;
    if (params.get("players")) thanks.players = params.get("players");
    var bookingId = params.get("bookingId") || params.get("booking_id") || params.get("transaction_id");
    if (bookingId) thanks.transaction_id = bookingId;
    track("thanks_view", thanks);
    // A finished-booking redirect is the completion signal. The same booking
    // id on a later load, including refresh, is ignored.
    if (bookingId) sendPurchase(bookingId, money(valueParam), params.get("email"));
  }

  if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
  prepareWidgetUrls();
  updateSticky();
  scheduleBokun();
})();
