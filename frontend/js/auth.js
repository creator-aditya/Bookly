function setMessage(text) {
  const el = document.getElementById("message");
  if (el) el.textContent = text;
}

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

const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("Logging in...");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: document.getElementById("email").value,
          password: document.getElementById("password").value
        })
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