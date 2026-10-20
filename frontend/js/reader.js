const params = new URLSearchParams(window.location.search);
const bookId = params.get("id");

const reader = document.getElementById("reader");
const message = document.getElementById("message");
const bookTitle = document.getElementById("bookTitle");
const bookAuthor = document.getElementById("bookAuthor");

function showMessage(text) {
  message.textContent = text;
  message.style.display = "block";
  if (reader) reader.style.display = "none";
}

async function loadBook() {
  if (!bookId || !/^\d+$/.test(bookId)) {
    showMessage("Invalid book.");
    return;
  }

  const token = localStorage.getItem("bookly_token");

  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  try {
    const response = await fetch(
      `/api/books/${bookId}/read?refresh=${Date.now()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    // 401 = no valid session at all → back to login.
    // 403 = authenticated but not allowed. Two sub-cases:
    //   - body.code === "PURCHASE_REQUIRED" → send them to pay.
    //   - anything else → fall through to normal error display
    //     (don't wipe the token — the session is fine).
    if (response.status === 401) {
      localStorage.removeItem("bookly_token");
      localStorage.removeItem("bookly_user");
      window.location.replace("/login.html");
      return;
    }

    if (response.status === 403) {
      const body = await response.json().catch(() => ({}));

      if (body.code === "PURCHASE_REQUIRED") {
        window.location.replace(`/purchase.html?id=${encodeURIComponent(bookId)}`);
        return;
      }

      throw new Error(body.error || "You don't have access to this book.");
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Unable to open book.");
    }

    bookTitle.textContent = data.book.title;
    bookAuthor.textContent = `By ${data.book.author}`;

    if (data.book.file_type === "PDF") {
      reader.src = data.reading_url;
    } else {
      showMessage("EPUB reading will be added next.");
    }
  } catch (error) {
    console.error(error);
    showMessage(error.message);
  }
}

loadBook();