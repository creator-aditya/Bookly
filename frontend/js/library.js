const libraryGrid = document.getElementById("libraryGrid");

async function loadLibrary() {
  if (!libraryGrid) return;

  libraryGrid.innerHTML = "<p class='muted'>Loading your library...</p>";

  try {
    const token = localStorage.getItem("bookly_token");

    if (!token) {
      window.location.href = "/login.html";
      return;
    }

    const response = await fetch("/api/library", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("bookly_token");
      window.location.replace("/login.html");
      return;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Unable to load your library.");
    }

    const books = Array.isArray(data.books) ? data.books : [];

    if (!books.length) {
      libraryGrid.innerHTML = "<p class='muted'>Your library is empty.</p>";
      return;
    }

    libraryGrid.innerHTML = books
      .map((book) => bookCard(book, { showRead: true, meta: "category" }))
      .join("");

    hideBrokenImages(libraryGrid);
  } catch (error) {
    console.error("Unable to load library:", error);
    libraryGrid.innerHTML = `<p class='muted'>${escapeHtml(error.message)}</p>`;
  }
}

loadLibrary();