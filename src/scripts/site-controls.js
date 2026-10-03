const emailWidget = document.querySelector("[data-email-reveal]");

if (emailWidget) {
  const showButton = emailWidget.querySelector(".email-show");
  const results = emailWidget.querySelector(".email-results");

  function copyText(value, button) {
    let resetTimer;
    const feedback = (label) => {
      button.textContent = label;
      button.setAttribute("aria-label", label === "copied" ? `Copied ${value}` : `Copy ${value}`);
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        button.textContent = "copy";
        button.setAttribute("aria-label", `Copy ${value}`);
      }, 1400);
    };
    const fallbackCopy = () => {
      const input = document.createElement("textarea");
      input.value = value;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.append(input);
      input.select();
      const copied = document.execCommand("copy");
      input.remove();
      feedback(copied ? "copied" : "copy failed");
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(
        () => feedback("copied"),
        fallbackCopy,
      );
    } else {
      fallbackCopy();
    }
  }

  showButton.addEventListener("click", () => {
    if (!results.hidden) {
      results.hidden = true;
      showButton.textContent = "show email";
      showButton.setAttribute("aria-expanded", "false");
      return;
    }
    const addresses = [
      ["jackyu", "caltech", "edu"],
      ["jack.yu", "ligo", "org"],
    ].map(([name, domain, tld]) => `${name}@${domain}.${tld}`);
    const protocol = ["ma", "ilto", ":"].join("");
    results.replaceChildren();

    addresses.forEach((address) => {
      const row = document.createElement("p");
      const link = document.createElement("a");
      const copy = document.createElement("button");
      link.href = `${protocol}${address}`;
      link.textContent = address;
      copy.className = "email-copy";
      copy.type = "button";
      copy.textContent = "copy";
      copy.setAttribute("aria-label", `Copy ${address}`);
      copy.addEventListener("click", () => copyText(address, copy));
      row.append(link, copy);
      results.append(row);
    });

    results.hidden = false;
    showButton.textContent = "hide email";
    showButton.setAttribute("aria-expanded", "true");
  });
}

const downloadButton = document.querySelector(".resume-download");
downloadButton?.addEventListener("click", () => {
  // Split strings stop most simple scrapers, not a headless browser that clicks; stronger protection needs a server-side gate such as Turnstile.
  const file = ["/", "files/", "7e3d9f1a-", "4c62-", "4b8e-", "a1d0-", "20261002.pdf"].join("");
  const link = document.createElement("a");
  link.href = file;
  link.download = "Jack-Yu-Resume.pdf";
  link.click();
});
