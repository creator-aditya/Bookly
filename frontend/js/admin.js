const uploadForm = document.getElementById("uploadForm");
const message = document.getElementById("message");
const submitButton = uploadForm.querySelector('button[type="submit"]');

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  message.textContent = "Uploading book...";

  const file = document.getElementById("book").files[0];

  if (!file) {
    message.textContent = "Please select a PDF or EPUB file.";
    return;
  }

  const formData = new FormData();

  formData.append("title", document.getElementById("title").value);
  formData.append("author", document.getElementById("author").value);
  formData.append("description", document.getElementById("description").value);
  formData.append("category", document.getElementById("category").value);
  formData.append("genre", document.getElementById("genre").value);
  formData.append("price", document.getElementById("price").value);
  formData.append("book", file);

  submitButton.disabled = true;

  try {
    const token = localStorage.getItem("bookly_token");

    const response = await fetch("/api/admin/books/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    // Only a truly invalid/expired token should log the user out.
    // A 403 means "logged in but not an admin" — show the error instead.
    if (response.status === 401) {
      localStorage.removeItem("bookly_token");
      localStorage.removeItem("bookly_user");
      window.location.replace("/login.html");
      return;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Upload failed.");
    }

    message.textContent = "Book uploaded successfully!";

    uploadForm.reset();

    console.log(data.book);
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});