const clock = document.querySelector(".clock-toggle");

if (clock) {
  const time = clock.querySelector(".clock-time");
  const date = clock.querySelector(".clock-date");
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
  });
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const updateClock = () => {
    const now = new Date();
    time.textContent = `pasadena · ${timeFormatter.format(now).toLowerCase()}`;
    date.textContent = `caltech · ${dateFormatter.format(now).replaceAll("-", ".")}`;
  };

  clock.addEventListener("click", () => {
    const expanded = clock.getAttribute("aria-expanded") === "true";
    clock.setAttribute("aria-expanded", String(!expanded));
    clock.setAttribute("aria-label", expanded ? "Show local date" : "Show Pasadena time");
    date.hidden = expanded;
  });

  updateClock();
  window.setInterval(updateClock, 60_000);
}