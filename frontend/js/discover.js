const grid = document.getElementById("bookGrid");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");

let requestId = 0;

const currentCategory =
  new URLSearchParams(location.search).get("category") || "";

async function loadBooks(search = "") {
  if (!grid) return;

  const term = search.trim();

  const qs = new URLSearchParams();

  if (term) {
    qs.set("search", term);
  }

  if (currentCategory) {
    qs.set("category", currentCategory);
  }

  const params = qs.toString() ? `?${qs.toString()}` : "";

  const myRequest = ++requestId;

  grid.innerHTML = "<p class='muted'>Searching...</p>";

  try {
    const response = await fetch(`/api/books${params}`);

    if (!response.ok) {
      throw new Error("Request failed: " + response.status);
    }

    const data = await response.json();

    if (myRequest !== requestId) {
      return;
    }

    grid.innerHTML = data.books.length
      ? data.books
          .map((book) =>
            bookCard(book, {
              meta: "category",
              showRead: true
            })
          )
          .join("")
      : "<p class='muted'>No books found.</p>";

    hideBrokenImages(grid);

  } catch (error) {
    if (myRequest !== requestId) {
      return;
    }

    console.error("Unable to load books:", error);

    grid.innerHTML =
      "<p class='muted'>Unable to load books.</p>";
  }
}

searchButton?.addEventListener("click", () => {
  loadBooks(searchInput?.value || "");
});

searchInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    loadBooks(searchInput.value);
  }
});

loadBooks();