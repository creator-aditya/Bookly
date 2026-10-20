/* Purchase page for paid books.
 * Reads ?id=<bookId>, creates a pending purchase via the API,
 * shows the UPI QR, then polls for admin verification.
 */
(function () {
  const TOKEN_KEY = "bookly_token";
  const POLL_INTERVAL_MS = 4000;

  const params = new URLSearchParams(location.search);
  const bookId = params.get("id");
  const token = localStorage.getItem(TOKEN_KEY);

  const $ = (id) => document.getElementById(id);

  if (!token) {
    location.replace("/login.html");
    return;
  }
  if (!bookId || !/^\d+$/.test(bookId)) {
    location.replace("/home.html");
    return;
  }

  let purchase = null;
  let pollTimer = null;

  function showStatus(kind, text) {
    const el = $("status");
    el.className = "status " + kind;
    el.textContent = text;
    el.style.display = "block";
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        ...(opts.headers || {})
      }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || ("HTTP " + res.status));
      err.status = res.status;
      err.code = data.code;
      throw err;
    }
    return data;
  }

  async function loadBook() {
    const res = await fetch("/api/books/" + encodeURIComponent(bookId));
    if (!res.ok) throw new Error("Unable to load book.");
    const data = await res.json();
    const book = data.book;

    $("bookTitle").textContent = book.title;
    $("bookAuthor").textContent = "by " + book.author;
    $("amount").textContent = "₹" + Number(book.price).toFixed(2);
  }

  async function startPurchase() {
    const data = await api("/api/purchases/" + encodeURIComponent(bookId) + "/start", {
      method: "POST"
    });
    purchase = data.purchase;
  }

  function renderQr() {
    const qrPayload = encodeURIComponent(purchase.upiString);
    $("qr").src =
      "https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=" + qrPayload;

    // Extract and display the VPA so the user can also pay manually
    try {
      const query = purchase.upiString.split("?")[1] || "";
      const vpa = new URLSearchParams(query).get("pa");
      $("upiId").textContent = vpa || "";
    } catch (_) {
      $("upiId").textContent = "";
    }
  }

  function enableConfirm() {
    $("confirmBtn").disabled = false;
  }

  function pollStatus() {
    if (pollTimer) clearInterval(pollTimer);

    pollTimer = setInterval(async () => {
      try {
        const data = await api("/api/purchases/status/" + encodeURIComponent(bookId));
        const p = data.purchase;
        if (!p) return;

        if (p.status === "paid") {
          clearInterval(pollTimer);
          showStatus("paid", "Payment verified! Opening the book…");
          setTimeout(() => {
            location.href = "/reader.html?id=" + encodeURIComponent(bookId);
          }, 1200);
        } else if (p.status === "rejected") {
          clearInterval(pollTimer);
          showStatus("error", "Purchase was rejected by admin. Contact support.");
        }
      } catch (_) {
        /* keep polling silently */
      }
    }, POLL_INTERVAL_MS);
  }

  async function init() {
    try {
      await loadBook();
      await startPurchase();
      renderQr();

      if (purchase.status === "paid") {
        showStatus("paid", "Already paid — opening reader…");
        setTimeout(() => {
          location.href = "/reader.html?id=" + encodeURIComponent(bookId);
        }, 1200);
        return;
      }

      enableConfirm();

      if (purchase.status === "pending" && purchase.userNote) {
        showStatus(
          "pending",
          "Waiting for admin verification. This page updates automatically."
        );
      }

      pollStatus();
    } catch (err) {
      if (err.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        location.replace("/login.html");
        return;
      }
      console.error(err);
      showStatus("error", err.message || "Something went wrong.");
    }
  }

  document.getElementById("confirmBtn").addEventListener("click", async () => {
    const note = $("note").value.trim();
    if (note.length < 4) {
      showStatus("error", "Please enter the UTR / transaction ID from your UPI app.");
      return;
    }

    try {
      $("confirmBtn").disabled = true;
      await api("/api/purchases/" + purchase.id + "/confirm", {
        method: "POST",
        body: JSON.stringify({ user_note: note })
      });
      showStatus(
        "pending",
        "Submitted. Waiting for admin verification — this page updates automatically."
      );
      pollStatus();
    } catch (err) {
      $("confirmBtn").disabled = false;
      showStatus("error", err.message || "Unable to confirm.");
    }
  });

  init();
})();