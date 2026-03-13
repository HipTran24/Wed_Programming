(function () {
  const form = document.getElementById("loginForm");
  if (!form) {
    return;
  }

  const tokenStorageKey = "auth.accessToken";
  const userStorageKey = "auth.currentUser";
  const messageElement = document.getElementById("loginMessage");
  const loginButton = document.getElementById("loginButton");
  let returnUrl = "index.html";

  const setMessage = (message, isSuccess) => {
    if (!messageElement) {
      return;
    }

    messageElement.textContent = message || "";
    messageElement.className = `small mb-3 ${isSuccess ? "text-success" : "text-warning"}`;
  };

  const setFieldError = (fieldId, message) => {
    const input = document.getElementById(fieldId);
    const error = document.getElementById(`${fieldId}Error`);

    if (input) {
      input.classList.add("is-invalid");
    }

    if (error) {
      error.textContent = message || "";
    }
  };

  const clearErrors = () => {
    ["emailOrUsername", "password"].forEach((fieldId) => {
      const input = document.getElementById(fieldId);
      const error = document.getElementById(`${fieldId}Error`);

      if (input) {
        input.classList.remove("is-invalid");
      }

      if (error) {
        error.textContent = "";
      }
    });
  };

  const setSubmitting = (isSubmitting) => {
    if (!loginButton) {
      return;
    }

    loginButton.disabled = isSubmitting;
    loginButton.textContent = isSubmitting ? "Đang đăng nhập..." : "Đăng nhập";
  };

  const setupPasswordToggle = () => {
    const toggle = document.getElementById("toggleLoginPassword");
    const passwordInput = document.getElementById("password");

    if (!toggle || !passwordInput) {
      return;
    }

    toggle.addEventListener("change", () => {
      passwordInput.type = toggle.checked ? "text" : "password";
    });
  };

  const readJsonSafely = async (response) => {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return null;
    }

    try {
      return await response.json();
    } catch {
      return null;
    }
  };

  const prefillFromQuery = () => {
    const query = new URLSearchParams(window.location.search);
    const email = (query.get("email") || "").trim();
    const verified = query.get("verified");
    const notice = (query.get("message") || "").trim();
    const requestedReturn = (query.get("returnUrl") || "").trim();
    const input = document.getElementById("emailOrUsername");

    if (requestedReturn) {
      returnUrl = requestedReturn;
    }

    if (input && email) {
      input.value = email;
    }

    if (verified === "1") {
      setMessage("Email đã được xác thực. Bạn có thể đăng nhập ngay.", true);
    }

    if (notice) {
      setMessage(notice, false);
    }
  };

  const redirectIfAlreadyLoggedIn = () => {
    const hasToken =
      !!window.localStorage.getItem(tokenStorageKey) ||
      !!window.sessionStorage.getItem(tokenStorageKey);

    if (!hasToken) {
      return;
    }

    window.location.href = returnUrl || "index.html";
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors();
    setMessage("", false);

    const emailOrUsername = (document.getElementById("emailOrUsername")?.value || "").trim();
    const password = document.getElementById("password")?.value || "";
    const rememberMe = document.getElementById("rememberMe")?.checked || false;

    if (!emailOrUsername) {
      setFieldError("emailOrUsername", "Vui lòng nhập email hoặc tên đăng nhập.");
      return;
    }

    if (!password) {
      setFieldError("password", "Vui lòng nhập mật khẩu.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailOrUsername,
          password,
          rememberMe,
        }),
      });

      const data = await readJsonSafely(response);
      if (!response.ok) {
        if (data?.errors && typeof data.errors === "object") {
          Object.entries(data.errors).forEach(([field, messages]) => {
            const fieldName = String(field || "").toLowerCase();
            if (fieldName.includes("emailorusername")) {
              setFieldError("emailOrUsername", Array.isArray(messages) ? String(messages[0]) : String(messages));
            }

            if (fieldName.includes("password")) {
              setFieldError("password", Array.isArray(messages) ? String(messages[0]) : String(messages));
            }
          });
          setMessage(data.title || "Thông tin đăng nhập chưa hợp lệ.", false);
          return;
        }

        setMessage(data?.message || "Đăng nhập thất bại.", false);
        return;
      }

      const token = data?.accessToken || "";
      if (!token) {
        setMessage("Đăng nhập thất bại: không nhận được token.", false);
        return;
      }

      const storage = rememberMe ? window.localStorage : window.sessionStorage;
      storage.setItem(tokenStorageKey, token);
      storage.setItem(
        userStorageKey,
        JSON.stringify({
          userId: data?.userId ?? null,
          username: data?.username ?? "",
          fullName: data?.fullName ?? "",
          email: data?.email ?? "",
          role: data?.role ?? "",
          expiresAt: data?.expiresAt ?? null,
        })
      );

      window.sessionStorage.removeItem("pendingEmailVerification");
      setMessage("Đăng nhập thành công. Đang chuyển trang...", true);
      window.setTimeout(() => {
        window.location.href = returnUrl || "index.html";
      }, 700);
    } catch (error) {
      console.error("login_failed", error);
      setMessage("Không thể kết nối tới máy chủ.", false);
    } finally {
      setSubmitting(false);
    }
  });

  prefillFromQuery();
  redirectIfAlreadyLoggedIn();
  setupPasswordToggle();
})();
