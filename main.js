(function () {
  var CHANNEL = "7cbce2f5-33c8-4d4b-92b2-bec34c99555c";
  var LOADER = "https://widgets.bokun.io/assets/javascripts/apps/build/BokunWidgetsLoader.js?bookingChannelUUID=" + CHANNEL;
  var HOSTED = "https://widgets.bokun.io/online-sales/" + CHANNEL + "/experience/1326696";
  var TRACK_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"];

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
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push(detail);
    }
  }

  window.cityclueTrack = track;

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
    if (modalOpen && !modalWasOpen) track("widget_open", {});
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
      return host === "bokun.io" || host.slice(-8) === ".bokun.io";
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

  window.addEventListener("message", function (event) {
    if (!isBokunOrigin(event.origin)) return;
    var message = readMessage(event.data);
    if (!message || !message.messageType) return;
    if (message.messageType === "AddingToCart") {
      track("checkout_start", {});
    }
    if (message.messageType === "BookingConfirmed") {
      var booking = message.booking || {};
      var purchase = { currency: "USD" };
      if (booking.status) purchase.status = booking.status;
      var total = booking.totalText ? String(booking.totalText) : "";
      var amount = total.replace(/,/g, "").match(/(\d+\.\d{2})/);
      if (amount) purchase.value = amount[1];
      track("purchase", purchase);
    }
  });

  var fallback = document.getElementById("book-fallback");
  if (widget && fallback) {
    window.setTimeout(function () {
      if (!widget.querySelector("iframe")) fallback.hidden = false;
    }, 12000);
  }

  if (document.body.getAttribute("data-page") === "thanks") {
    var params = new URLSearchParams(window.location.search);
    var thanks = { currency: "USD" };
    if (params.get("value")) thanks.value = params.get("value");
    if (params.get("players")) thanks.players = params.get("players");
    track("thanks_view", thanks);
  }

  if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
  prepareWidgetUrls();
  updateSticky();
  scheduleBokun();
})();
