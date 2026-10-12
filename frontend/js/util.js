function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

// Only allow http(s) or same-site absolute paths (blocks javascript: and //host URLs)
function safeUrl(url) {
  return /^https?:\/\/|^\/(?!\/)/.test(url || "") ? url : "";
}

function bookCard(book, { showRead = false, meta = "genre" } = {}) {
  const cover = safeUrl(book.cover_image);
  return `
    <article class="book-card">
      <div class="cover">
        ${cover
          ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(book.title)} cover" loading="lazy">`
          : ""}
      </div>
      <div class="book-info">
        <h3>${escapeHtml(book.title)}</h3>
        <div class="author">${escapeHtml(book.author || "Unknown Author")}</div>
        <div class="book-meta">
          <span>${escapeHtml(book[meta])}</span>
          <span class="price">${book.is_free ? "FREE" : `₹${escapeHtml(book.price)}`}</span>
        </div>
        ${showRead
          ? `<a class="read-button" href="/reader.html?id=${encodeURIComponent(book.id)}">Read</a>`
          : ""}
      </div>
    </article>`;
}

function hideBrokenImages(container) {
  if (!container) return;
  container.querySelectorAll("img").forEach((img) => {
    img.addEventListener("error", () => {
      img.style.display = "none";
    });
  });
}

// Wire up the logout button if this page has one.
// Pages without a #logout button are silently skipped.
const logoutBtn = document.getElementById("logout");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("bookly_token");
    localStorage.removeItem("bookly_user");
    window.location.href = "/login.html";
  });
}