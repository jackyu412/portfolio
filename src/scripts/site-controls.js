function initializeSiteControls() {
  const emailWidget = document.querySelector("[data-email-reveal]");

  if (emailWidget && !emailWidget.dataset.controlsReady) {
    const showButton = emailWidget.querySelector(".email-show");
    const results = emailWidget.querySelector(".email-results");

    if (showButton && results) {
      emailWidget.dataset.controlsReady = "true";

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
  }

}

initializeSiteControls();
document.addEventListener("astro:page-load", initializeSiteControls);
