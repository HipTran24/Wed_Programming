(function () {
  const form = document.getElementById("registerForm");
  if (!form) {
    return;
  }

  const fieldIds = [
    "username",
    "fullName",
    "email",
    "password",
    "confirmPassword",
    "acceptTerms",
  ];

  const messageElement = document.getElementById("registerMessage");
  const registerButton = document.getElementById("registerButton");

  const clearErrors = () => {
    for (const fieldId of fieldIds) {
      const errorElement = document.getElementById(`${fieldId}Error`);
      if (errorElement) {
        errorElement.textContent = "";
      }
    }

    for (const inputId of ["username", "fullName", "email", "password", "confirmPassword"]) {
      const input = document.getElementById(inputId);
      if (input) {
        input.classList.remove("is-invalid");
      }
    }
  };

  const setFieldError = (fieldName, message) => {
    const errorElement = document.getElementById(`${fieldName}Error`);
    if (errorElement) {
      errorElement.textContent = message;
    }

    if (fieldName !== "acceptTerms") {
      const input = document.getElementById(fieldName);
      if (input) {
        input.classList.add("is-invalid");
      }
    }
  };

  const setMessage = (message, isSuccess) => {
    if (!messageElement) {
      return;
    }

    messageElement.textContent = message;
    messageElement.className = `small mb-3 ${isSuccess ? "text-success" : "text-warning"}`;
  };

  const setSubmitting = (isSubmitting) => {
    if (!registerButton) {
      return;
    }

    registerButton.disabled = isSubmitting;
    registerButton.textContent = isSubmitting ? "Đang tạo tài khoản..." : "Tạo tài khoản";
  };

  const getPayload = () => {
    return {
      username: (document.getElementById("username")?.value || "").trim(),
      fullName: (document.getElementById("fullName")?.value || "").trim(),
      email: (document.getElementById("email")?.value || "").trim(),
      password: document.getElementById("password")?.value || "",
      confirmPassword: document.getElementById("confirmPassword")?.value || "",
      acceptTerms: document.getElementById("agree")?.checked || false,
    };
  };

  const mapServerFieldToClientField = (fieldName) => {
    const normalized = fieldName.toLowerCase();
    switch (normalized) {
      case "username":
        return "username";
      case "fullname":
        return "fullName";
      case "email":
        return "email";
      case "password":
        return "password";
      case "confirmpassword":
        return "confirmPassword";
      case "acceptterms":
        return "acceptTerms";
      default:
        return "";
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors();
    setMessage("", false);

    const payload = getPayload();

    if (!payload.acceptTerms) {
      setFieldError("acceptTerms", "Bạn cần đồng ý với điều khoản sử dụng.");
      return;
    }

    if (payload.password !== payload.confirmPassword) {
      setFieldError("confirmPassword", "Mật khẩu nhập lại không khớp.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : null;

      if (!response.ok) {
        if (response.status === 400 && data?.errors) {
          for (const [fieldName, messages] of Object.entries(data.errors)) {
            const clientField = mapServerFieldToClientField(fieldName);
            if (clientField) {
              setFieldError(clientField, Array.isArray(messages) ? messages[0] : String(messages));
            }
          }
          setMessage("Thông tin đăng ký chưa hợp lệ.", false);
          return;
        }

        if (response.status === 409) {
          setMessage(data?.message || "Tên đăng nhập hoặc email đã tồn tại.", false);
          return;
        }

        setMessage("Đăng ký thất bại. Vui lòng thử lại.", false);
        return;
      }

      form.reset();
      setMessage("Đăng ký thành công. Đang chuyển sang trang đăng nhập...", true);
      window.setTimeout(() => {
        window.location.href = "login.html";
      }, 1200);
    } catch (error) {
      console.error("register_failed", error);
      setMessage("Không thể kết nối tới máy chủ.", false);
    } finally {
      setSubmitting(false);
    }
  });
})();
