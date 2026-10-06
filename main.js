(function () {
  var form = document.querySelector("#waitlist-form");
  if (!form) return;

  var storageKey = "cityclue-waitlist";
  var input = document.querySelector("#email");
  var error = document.querySelector("#email-error");
  var success = document.querySelector("#waitlist-success");
  var successTitle = document.querySelector("#success-title");
  var successBody = document.querySelector("#success-body");
  var successEmail = document.querySelector("#saved-email");
  var resetButton = document.querySelector("#waitlist-reset");
  var defaultError = error.textContent;

  function emailOk(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  }

  function readSaved() {
    try {
      var raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.email !== "string") return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function writeSaved(record) {
    localStorage.setItem(storageKey, JSON.stringify(record));
  }

  function clearSaved() {
    localStorage.removeItem(storageKey);
  }

  function showError(message) {
    error.textContent = message;
    error.hidden = false;
    input.setAttribute("aria-invalid", "true");
  }

  function clearError() {
    error.textContent = defaultError;
    error.hidden = true;
    input.removeAttribute("aria-invalid");
  }

  function showSuccess(record, shouldFocus) {
    var remote = record.mode === "remote";
    successTitle.textContent = remote ? "You're on the list" : "Saved on this phone";
    successBody.textContent = remote
      ? "We'll email you when the Strip pack opens."
      : "This address stays in this browser. It has not been sent. When the Strip list is live, enter it again to join.";
    successEmail.textContent = record.email;
    form.hidden = true;
    success.hidden = false;
    if (shouldFocus) successTitle.focus();
  }

  function showForm() {
    success.hidden = true;
    form.hidden = false;
    input.value = "";
    clearError();
    input.focus();
  }

  var existing = readSaved();
  if (existing) showSuccess(existing, false);

  input.addEventListener("input", function () {
    if (input.getAttribute("aria-invalid") === "true" && emailOk(input.value.trim())) {
      clearError();
    }
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var email = input.value.trim();
    if (!emailOk(email)) {
      showError(defaultError);
      input.focus();
      return;
    }

    clearError();
    var endpoint = (form.getAttribute("data-endpoint") || "").trim();
    var button = form.querySelector("[type='submit']");
    button.disabled = true;

    var done = function (mode) {
      var record = { email: email, mode: mode };
      try {
        writeSaved(record);
      } catch (err) {
        if (mode !== "remote") {
          showError("This browser blocked saving your email on this device.");
          button.disabled = false;
          return;
        }
      }
      showSuccess(record, true);
      button.disabled = false;
    };

    if (!endpoint) {
      done("local");
      return;
    }

    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ email: email })
    })
      .then(function (response) {
        if (!response.ok) throw new Error("Request failed");
        done("remote");
      })
      .catch(function () {
        showError("We couldn't reach the list just now. Try again in a moment.");
        button.disabled = false;
      });
  });

  resetButton.addEventListener("click", function () {
    try {
      clearSaved();
    } catch (err) {
      /* Storage can be blocked; still return to the form. */
    }
    showForm();
  });
})();
