(() => {
  const el = document.getElementById("offer");
  const cfg = window.RGM_CONFIG || {};

  if (!el || !cfg.PUBLIC_API_BASE) {
    return;
  }

  const api = cfg.PUBLIC_API_BASE.replace(/\/$/, "");

  fetch(api + "/pricing", {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  })
    .then(async (response) => {
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Pricing request failed");
      }

      return data;
    })
    .then((data) => {
      const normalPrice = Number(data.normal_price || 499);
      const price = Number(data.price || normalPrice);

      if (data.campaign_active) {
        el.innerHTML = `
          <b>${escapeHtml(data.campaign_name || "Special Offer")}</b>
          <del>₹${normalPrice.toLocaleString("en-IN")}</del>
          <strong>₹${price.toLocaleString("en-IN")}</strong>
          <span>limited-time offer</span>
        `;
      } else {
        el.innerHTML = `
          <b>Personalized song</b>
          <strong>₹${normalPrice.toLocaleString("en-IN")}</strong>
          <span>payment required to place an order</span>
        `;
      }
    })
    .catch((error) => {
      console.error("Pricing load failed:", error);

      el.innerHTML = `
        <b>Personalized song</b>
        <strong>₹499</strong>
        <span>payment required to place an order</span>
      `;
    });

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
