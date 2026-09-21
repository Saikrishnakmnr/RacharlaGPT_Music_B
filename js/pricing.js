(() => {
  const el = document.getElementById("offer");
  const cfg = window.RGM_CONFIG || {};

  if (!el) {
    console.error("RGM pricing: #offer element not found");
    return;
  }

  if (!cfg.PUBLIC_API_BASE) {
    console.error("RGM pricing: PUBLIC_API_BASE missing");
    el.innerHTML = `
      <b>Pricing configuration error</b>
      <strong>₹99</strong>
    `;
    return;
  }

  const api = cfg.PUBLIC_API_BASE.replace(/\/$/, "");
  const url = api + "/pricing";

  console.log("RGM pricing requesting:", url);

  fetch(url, {
    method: "GET",
    mode: "cors",
    cache: "no-store",
    headers: {
      "Accept": "application/json"
    }
  })
    .then(async response => {

      console.log(
        "RGM pricing HTTP status:",
        response.status
      );

      const text = await response.text();

      console.log(
        "RGM pricing response:",
        text
      );

      if (!response.ok) {
        throw new Error(
          "Pricing API HTTP " + response.status
        );
      }

      return JSON.parse(text);
    })
    .then(data => {

      console.log(
        "RGM pricing data:",
        data
      );

      const normalPrice =
        Number(data.normal_price || 499);

      const price =
        Number(data.price || normalPrice);

      if (data.campaign_active === true) {

        el.innerHTML = `
          <b>${data.campaign_name || "Special Offer"}</b>
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
    .catch(error => {

      console.error(
        "RGM pricing FAILED:",
        error
      );

      /*
       * Do NOT silently show ₹499 while debugging.
       */
      el.innerHTML = `
        <b>Pricing connection error</b>
        <strong>₹99</strong>
        <span>please refresh</span>
      `;

    });

})();
