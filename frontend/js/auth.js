function setMessage(text) {
  const el = document.getElementById("message");
  if (el) el.textContent = text;
}

/* =========================
   REGISTER
========================= */

const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("Creating account...");

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const dateOfBirth = document.getElementById("dateOfBirth").value;

    const dob = new Date(`${dateOfBirth}T00:00:00`);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const month = today.getMonth() - dob.getMonth();
    if (month < 0 || (month === 0 && today.getDate() < dob.getDate())) age--;

    if (age < 18) {
      setMessage("Under 18: this platform is restricted to users aged 18 and above.");
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, dateOfBirth })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      localStorage.setItem("bookly_token", data.token);
      localStorage.setItem("bookly_user", JSON.stringify(data.user));
      window.location.href = "/home.html";
    } catch (error) {
      setMessage(error.message);
    }
  });
}

/* =========================
   LOGIN — role selector
========================= */

const roleGrid = document.getElementById("roleGrid");
const roleInput = document.getElementById("selectedRole");
const loginForm = document.getElementById("loginForm");

function selectRole(role) {
  if (!roleGrid || !roleInput || !loginForm) return;

  roleGrid.querySelectorAll(".role-card").forEach((card) => {
    const isSelected = card.dataset.role === role;
    card.classList.toggle("selected", isSelected);
    card.setAttribute("aria-checked", isSelected ? "true" : "false");
  });

  roleInput.value = role;
  loginForm.classList.add("active");
  setMessage("");
}

if (roleGrid && loginForm) {
  // Skip the login form entirely if the user is already signed in.
  if (localStorage.getItem("bookly_token")) {
    try {
      const existing = JSON.parse(localStorage.getItem("bookly_user") || "{}");
      if (existing && existing.role) {
        window.location.replace(
          existing.role === "ADMIN" ? "/admin.html" : "/home.html"
        );
      }
    } catch (_) {
      /* malformed stored user — fall through to normal login */
    }
  }

  roleGrid.addEventListener("click", (event) => {
    const card = event.target.closest(".role-card");
    if (card) selectRole(card.dataset.role);
  });

  roleGrid.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      const card = event.target.closest(".role-card");
      if (card) {
        event.preventDefault();
        selectRole(card.dataset.role);
      }
    }
  });
}

/* =========================
   LOGIN — submit
========================= */

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const role = roleInput ? roleInput.value : "";

    if (!role) {
      setMessage("Please select Reader or Admin first.");
      return;
    }

    setMessage("Logging in...");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: document.getElementById("email").value,
          password: document.getElementById("password").value,
          role
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      localStorage.setItem("bookly_token", data.token);
      localStorage.setItem("bookly_user", JSON.stringify(data.user));

      if (role === "ADMIN" && data.user.role === "ADMIN") {
        window.location.href = "/admin.html";
      } else {
        window.location.href = "/home.html";
      }
    } catch (error) {
      setMessage(error.message);
    }
  });
}