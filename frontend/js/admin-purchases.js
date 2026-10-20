/* Admin: pending-purchase verification panel.
 * Wrapped in an IIFE so nothing leaks into the global scope and
 * collides with the variables declared by admin.js.
 */
(function () {
  // Your app stores the JWT under "bookly_token" (reader.js uses the
  // same key). If you change this key anywhere, change it here too.
  const TOKEN_KEY = "bookly_token";

  const token = localStorage.getItem(TOKEN_KEY);
  const list = document.getElementById("purchaseList");
  const refreshBtn = document.getElementById("refreshPurchases");

  if (!list || !refreshBtn) return;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => {
      switch (c) {
        case "&": return "&amp;";
        case "<": return "&lt;";
        case ">": return "&gt;";
        case '"': return "&quot;";
        case "'": return "&#39;";
        default:  return c;
      }
    });
  }

  async function loadPending() {
    list.innerHTML = '<p class="empty">Loading…</p>';

    if (!token) {
      list.innerHTML = '<p class="empty">Not signed in.</p>';
      return;
    }

    try {
      const res = await fetch("/api/admin/purchases?status=pending", {
        headers: { Authorization: "Bearer " + token }
      });

      if (res.status === 401 || res.status === 403) {
        list.innerHTML = '<p class="empty">Not authorized. Sign in as an admin.</p>';
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        list.innerHTML = '<p class="empty">' + escapeHtml(data.error || "Unable to load purchases.") + '</p>';
        return;
      }

      if (!data.purchases || !data.purchases.length) {
        list.innerHTML = '<p class="empty">No pending purchases.</p>';
        return;
      }

      list.innerHTML = "";

      for (const p of data.purchases) {
        const amount = Number(p.amount).toFixed(2);
        const created = p.createdAt ? new Date(p.createdAt).toLocaleString() : "";

        const card = document.createElement("div");
        card.className = "purchase-card";
        card.innerHTML = `
          <div><strong>${escapeHtml(p.bookTitle)}</strong> — ₹${amount} ${escapeHtml(p.currency || "INR")}</div>
          <div class="row">User: ${escapeHtml(p.userEmail)}</div>
          <div class="row">Reference: ${escapeHtml(p.reference)}</div>
          <div class="row">UTR given: ${escapeHtml(p.userNote || "(none)")}</div>
          <div class="row">Created: ${escapeHtml(created)}</div>
          <div class="actions">
            <button class="btn-paid"   data-id="${escapeHtml(p.id)}" data-act="paid">Mark paid</button>
            <button class="btn-reject" data-id="${escapeHtml(p.id)}" data-act="rejected">Reject</button>
          </div>
        `;

        list.appendChild(card);
      }
    } catch (err) {
      console.error(err);
      list.innerHTML = '<p class="empty">Network error.</p>';
    }
  }

  refreshBtn.addEventListener("click", loadPending);

  list.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;
    const status = btn.dataset.act;
    if (!id || !status) return;

    const label = status === "paid" ? "Mark as PAID" : "REJECT";
    if (!confirm(`${label}? This cannot be undone.`)) return;

    btn.disabled = true;

    try {
      const res = await fetch(
        "/api/admin/purchases/" + encodeURIComponent(id) + "/verify",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ status })
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.error || "Unable to update purchase.");
        btn.disabled = false;
        return;
      }

      loadPending();
    } catch (err) {
      console.error(err);
      alert("Network error.");
      btn.disabled = false;
    }
  });

  loadPending();
})();