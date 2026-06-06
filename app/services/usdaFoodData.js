export async function searchUsdaFoodData({ query, apiKey }) {
  if (!apiKey) throw new Error("Introduce una API key manual para pruebas. En producción debe usarse backend/proxy.");
  if (!query?.trim()) throw new Error("Introduce un alimento para buscar.");
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", query.trim());
  url.searchParams.set("pageSize", "10");
  const response = await fetch(url);
  if (!response.ok) throw new Error("No se pudo consultar USDA FoodData Central.");
  return response.json();
}
