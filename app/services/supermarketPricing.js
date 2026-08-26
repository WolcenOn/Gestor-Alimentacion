export function summarizeUnitPrice(product) {
  const pricePerUnit = Number(product?.pricePerUnit || 0);
  const priceUnit = String(product?.priceUnit || "").trim().toLowerCase();
  if (!(pricePerUnit > 0) || !priceUnit) return null;

  let referenceAmount = 0;
  let referenceUnit = "";
  let referencePrice = 0;
  if (priceUnit === "kg") {
    referenceAmount = 100;
    referenceUnit = "g";
    referencePrice = pricePerUnit / 10;
  } else if (priceUnit === "l") {
    referenceAmount = 100;
    referenceUnit = "ml";
    referencePrice = pricePerUnit / 10;
  }

  return {
    pricePerUnit,
    priceUnit,
    referenceAmount,
    referenceUnit,
    referencePrice,
    variableWeight: product?.variableWeight === true
  };
}
