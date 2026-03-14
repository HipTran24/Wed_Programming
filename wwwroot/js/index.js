(function () {
  if (window.AuthClient && window.AuthClient.isAuthenticated()) {
    const guest = document.querySelector("[data-auth-guest]");
    const user = document.querySelector("[data-auth-user]");

    if (guest) {
      guest.style.display = "none";
    }

    if (user) {
      user.style.display = "inline-flex";
    }

    const current = window.AuthClient.getCurrentUser();
    if (current) {
      window.AuthClient.bindUserUi(current);
    }
  }

  const navbar = document.getElementById("navbar");
  if (navbar) {
    window.addEventListener("scroll", () => {
      navbar.classList.toggle("scrolled", window.scrollY > 40);
    });
  }

  const reveals = document.querySelectorAll(".reveal");
  if (reveals.length > 0) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.12 }
    );

    reveals.forEach((element) => io.observe(element));
  }
})();
