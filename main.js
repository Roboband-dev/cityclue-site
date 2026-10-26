(function () {
  var CHANNEL = "7cbce2f5-33c8-4d4b-92b2-bec34c99555c";
  var LOADER = "https://widgets.bokun.io/assets/javascripts/apps/build/BokunWidgetsLoader.js?bookingChannelUUID=" + CHANNEL;
  var CALENDAR = "https://widgets.bokun.io/online-sales/" + CHANNEL + "/experience-calendar/1326696";

  // Public container id. BokunWidgets.js injects GTM with an inline script when
  // no script[src^="https://www.googletagmanager.com/gtm.js"] is already on the
  // page, then tells its iframes the parent handled tagging. CSP blocks that
  // inline script, so the container never loaded. This file loads it instead.
  // The container is the only config of AW-18531609653: Google tag on All Pages,
  // Conversion Linker, and an Ads conversion on the dataLayer event "purchase"
  // (order id ecommerce.transaction_id, label 7l5DCO3TjKYdELXYx4RF).
  var GTM_ID = "GTM-TWJ46LDV";

  var TRACK_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "gbraid", "wbraid", "gclsrc", "gad_source", "fbclid"];
  var gtmInstalled = false;
  var checkoutBegan = false;
  var statusTimer = 0;
  var DATE_CTAS = { header: true, sticky: true, hero: true, features: true, final: true };

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
    // Keep this page's own signals out of dataLayer. GTM's Ads tag fires on
    // an event named purchase, so a local purchase or scroll object must not
    // be pushed there.
    if (Array.isArray(window.dataLayer) && !gtmInstalled) {
      window.dataLayer.push(detail);
    }
  }

  window.cityclueTrack = track;

  function installGtm() {
    if (gtmInstalled) return;
    gtmInstalled = true;
    window.dataLayer = window.dataLayer || [];
    // Queue only. The Google tag inside GTM reads this. Do not config AW- here.
    window.gtag = window.gtag || function () {
      window.dataLayer.push(arguments);
    };
    window.dataLayer.push({
      "gtm.start": new Date().getTime(),
      event: "gtm.js"
    });
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtm.js?id=" + GTM_ID;
    document.head.appendChild(script);
  }

  installGtm();

  function money(text) {
    if (typeof text === "number" && isFinite(text)) return Math.round(text * 100) / 100;
    var cleaned = String(text == null ? "" : text).replace(/,/g, "");
    var match = cleaned.match(/(\d+\.\d{2})/);
    if (!match) return null;
    return Number(match[1]);
  }

  function beginCheckout(source) {
    if (checkoutBegan) return;
    checkoutBegan = true;
    track("begin_checkout", { source: source });
    // Plain dataLayer event. GTM's Ads conversion listens for "purchase" only,
    // so this does not send a conversion and it does not config the Google tag.
    window.dataLayer.push({
      event: "begin_checkout",
      currency: "USD"
    });
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

  function toCalendarUrl(url) {
    try {
      var next = new URL(url, window.location.href);
      if (/\/experience\/1326696\/?$/.test(next.pathname)) {
        next.pathname = new URL(CALENDAR).pathname;
        next.searchParams.delete("partialView");
      }
      return next.toString();
    } catch (err) {
      return url;
    }
  }

  function prepareWidgetUrls() {
    document.querySelectorAll(".bokunWidget[data-src], a.bokunButton[href]").forEach(function (el) {
      if (el.classList.contains("bokunWidget")) {
        el.setAttribute("data-src", withTracking(el.getAttribute("data-src")));
      } else {
        el.setAttribute("href", withTracking(toCalendarUrl(el.getAttribute("href"))));
      }
    });
  }

  function hideBookingStatus() {
    var status = document.getElementById("booking-status");
    if (status) status.hidden = true;
    if (statusTimer) {
      window.clearTimeout(statusTimer);
      statusTimer = 0;
    }
  }

  function showBookingStatus(mode) {
    var status = document.getElementById("booking-status");
    if (!status) {
      status = document.createElement("div");
      status.id = "booking-status";
      status.className = "booking-status";
      status.setAttribute("role", "status");
      status.innerHTML = '<span class="booking-spinner" aria-hidden="true"></span><span>Opening secure booking…</span>';
      document.body.appendChild(status);
    }
    status.hidden = false;
    if (statusTimer) window.clearTimeout(statusTimer);
    /* The overlay preload never fires a fresh load event, so do not wait on
       one. Hide as soon as the modal is visible, and never later than 1.8s. */
    statusTimer = window.setTimeout(hideBookingStatus, mode === "scroll" ? 800 : 1800);
    if (mode === "overlay") watchBookingSurface();
  }

  function watchBookingSurface() {
    var tries = 0;
    var timer = window.setInterval(function () {
      tries += 1;
      if (modalIsOpen()) {
        window.clearInterval(timer);
        hideBookingStatus();
      } else if (tries > 18) {
        window.clearInterval(timer);
      }
    }, 100);
  }

  function collapseCartBubble() {
    document.querySelectorAll("iframe").forEach(function (el) {
      var src = el.getAttribute("src") || "";
      if (src.indexOf("WidgetsCartBubble") === -1 && src.indexOf("CartBubble") === -1) return;
      if (el.getAttribute("data-cityclue-cart") === "hidden") return;
      el.setAttribute("data-cityclue-cart", "hidden");
      var nodes = [el];
      var parent = el.parentElement;
      if (parent && parent !== document.body && parent.id !== "bokun-modal-container") {
        var onlyBubble = true;
        Array.prototype.forEach.call(parent.children, function (child) {
          if (child !== el && child.tagName !== "SCRIPT") onlyBubble = false;
        });
        if (onlyBubble) nodes.push(parent);
      }
      nodes.forEach(function (node) {
        node.style.setProperty("position", "absolute", "important");
        node.style.setProperty("width", "0", "important");
        node.style.setProperty("height", "0", "important");
        node.style.setProperty("min-height", "0", "important");
        node.style.setProperty("max-height", "0", "important");
        node.style.setProperty("overflow", "hidden", "important");
        node.style.setProperty("opacity", "0", "important");
        node.style.setProperty("pointer-events", "none", "important");
        node.style.setProperty("margin", "0", "important");
        node.style.setProperty("border", "0", "important");
        node.style.setProperty("inset", "auto", "important");
      });
    });
  }

  function revealDates(shell) {
    if (!shell || !shell.classList.contains("is-ready")) return;
    if (shell.getAttribute("data-cityclue-hold") === "true") return;
    var frame = shell.querySelector("iframe");
    if (!frame) return;
    var view = shell.clientHeight;
    var doc = frame.offsetHeight;
    if (view < 80 || doc <= view + 8) return;
    /* The month grid sits under the participant row and above Bokun's
       booking summary, around the top 59% of the frame. Bias the visible
       window there so the bookable days are on screen. */
    var focusBottom = Math.round(doc * 0.59);
    var top = Math.max(0, focusBottom - view + 16);
    if (Math.abs(shell.scrollTop - top) < 4) return;
    shell.scrollTop = top;
  }

  function watchCalendar(shell) {
    if (!shell) return;
    var widget = shell.querySelector(".bokunWidget") || shell;
    function hold() {
      shell.setAttribute("data-cityclue-hold", "true");
    }
    shell.addEventListener("wheel", hold, { passive: true });
    shell.addEventListener("touchstart", hold, { passive: true });
    function arm(frame) {
      if (!frame || frame.getAttribute("data-cityclue-cal") === "true") return;
      frame.setAttribute("data-cityclue-cal", "true");
      frame.addEventListener("load", function () {
        shell.classList.add("is-ready");
        revealDates(shell);
      });
      if ("ResizeObserver" in window) {
        new ResizeObserver(function () { revealDates(shell); }).observe(frame);
      }
    }
    function scan() {
      arm(widget.querySelector("iframe"));
    }
    scan();
    if ("MutationObserver" in window) {
      new MutationObserver(scan).observe(widget, { childList: true, subtree: true });
    }
    window.setTimeout(function () {
      shell.classList.add("is-ready");
      revealDates(shell);
    }, 20000);
    window.setTimeout(function () { revealDates(shell); }, 800);
    window.setTimeout(function () { revealDates(shell); }, 1800);
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

  // Homepage Book buttons scroll to the calendar already on the page. That is
  // one tap and skips the product-page overlay. Pages without #book keep the
  // button click, and the href is the experience calendar.
  window.addEventListener("click", function (event) {
    var node = event.target;
    var link = node && node.closest ? node.closest("a[data-cta]") : null;
    if (!link || !DATE_CTAS[link.getAttribute("data-cta")]) return;
    var bookTarget = document.getElementById("book-calendar") || document.getElementById("book");
    if (!bookTarget) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    var cta = link.getAttribute("data-cta");
    if (event.isTrusted) track("cta_click", { location: cta });
    var desktopHero = cta === "hero" && window.matchMedia("(min-width: 900px)").matches;
    if (!desktopHero) beginCheckout("book");
    showBookingStatus("scroll");
    loadBokun();
    link.setAttribute("aria-busy", "true");
    window.setTimeout(function () { link.removeAttribute("aria-busy"); }, 800);
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bookTarget.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }, true);

  document.querySelectorAll("a.bokunButton").forEach(function (el) {
    el.addEventListener("click", function (event) {
      beginCheckout("book");
      if (event.isTrusted) track("cta_click", { location: el.getAttribute("data-cta") || "book" });
      showBookingStatus("overlay");
      if (el.getAttribute("data-bokun-widget-loaded") === "true") return;
      if (loaderFailed) return;
      event.preventDefault();
      if (el.getAttribute("data-booking-wait") === "true") return;
      el.setAttribute("data-booking-wait", "true");
      el.setAttribute("aria-busy", "true");
      loadBokun();
      var tries = 0;
      var timer = window.setInterval(function () {
        tries += 1;
        if (el.getAttribute("data-bokun-widget-loaded") === "true") {
          window.clearInterval(timer);
          el.removeAttribute("data-booking-wait");
          el.removeAttribute("aria-busy");
          el.click();
        } else if (loaderFailed || tries > 40) {
          window.clearInterval(timer);
          el.removeAttribute("data-booking-wait");
          el.removeAttribute("aria-busy");
          window.location.assign(el.href);
        }
      }, 100);
    });
  });

  var priceTracked = false;
  var calendarShell = document.querySelector("#book .calendar-shell");
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

  var syncingModal = false;
  function syncModal() {
    if (syncingModal) return;
    syncingModal = true;
    modalOpen = modalIsOpen();
    if (modalOpen && !modalWasOpen) {
      track("widget_open", {});
      beginCheckout("widget");
    }
    if (modalOpen || modalWasOpen) hideBookingStatus();
    modalWasOpen = modalOpen;
    collapseCartBubble();
    updateSticky();
    syncingModal = false;
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
    }
    if (message.messageType === "GaEvent") {
      if (Array.isArray(message.args) && message.args[0] === "event" && message.args[1] === "begin_checkout") {
        beginCheckout("bokun");
      }
      // Bokun's own parent listener pushes a forwarded object, including a
      // dataLayer purchase, onto this page. GTM's conversion tag already
      // fires on that event. This page does not send a second conversion.
    }
  }

  window.addEventListener("message", function (event) {
    handleBokunMessage(event.origin, event.data);
  });

  window.cityclueAds = {
    configured: function () { return gtmInstalled; },
    container: GTM_ID,
    handleBokunMessage: handleBokunMessage,
    beginCheckout: beginCheckout
  };

  var fallback = document.getElementById("book-fallback");
  if (calendarShell) watchCalendar(calendarShell);
  if (widget) {
    if (fallback) {
      window.setTimeout(function () {
        if (!widget.querySelector("iframe")) fallback.hidden = false;
      }, 12000);
    }
  }

  if (document.body.getAttribute("data-page") === "thanks") {
    var params = new URLSearchParams(window.location.search);
    var thanks = { currency: "USD" };
    var valueParam = params.get("value") || params.get("total");
    if (valueParam) thanks.value = valueParam;
    if (params.get("players")) thanks.players = params.get("players");
    var bookingId = params.get("bookingId") || params.get("booking_id") || params.get("transaction_id");
    if (bookingId) thanks.transaction_id = bookingId;
    track("thanks_view", thanks);
  }

  if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
  prepareWidgetUrls();
  updateSticky();
  scheduleBokun();
})();
