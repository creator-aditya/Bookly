const grid = document.getElementById("bookGrid");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");

let requestId = 0;

const currentCategory =
  new URLSearchParams(location.search).get("category") || "";

async function loadBooks(search = "") {
  if (!grid) return;

  const term = search.trim();
  const myRequest = ++requestId;

  grid.innerHTML = "<p class='muted'>Loading books...</p>";

  try {
    let books = [];

    if (!term && !currentCategory && localStorage.getItem("bookly_token")) {
      const recRes = await fetch("/api/recommendations?limit=12", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("bookly_token")}`
        }
      });

      if (recRes.ok) {
        const recData = await recRes.json();
        books = Array.isArray(recData.recommendations)
          ? recData.recommendations
          : [];
      }
    }

    if (!books.length) {
      const qs = new URLSearchParams();
      if (term) qs.set("search", term);
      if (currentCategory) qs.set("category", currentCategory);

      const params = qs.toString() ? `?${qs.toString()}` : "";
      const response = await fetch(`/api/books${params}`);

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const data = await response.json();
      books = Array.isArray(data.books) ? data.books : [];
    }

    if (myRequest !== requestId) return;

    if (!books.length) {
      grid.innerHTML = "<p class='muted'>No books found.</p>";
      return;
    }

    grid.innerHTML = books
      .map((book) => bookCard(book, { showRead: true, meta: "category" }))
      .join("");

    hideBrokenImages(grid);
  } catch (error) {
    if (myRequest !== requestId) return;
    console.error("Unable to load books:", error);
    grid.innerHTML = "<p class='muted'>Unable to load books.</p>";
  }
}

searchButton?.addEventListener("click", () => {
  loadBooks(searchInput?.value || "");
});

searchInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loadBooks(searchInput.value);
});

loadBooks();