import { getApiBaseUrl, getCloudSession, isCloudConfigured, isLoggedIn } from "../apiClient.js";

async function searchViaBackend(query) {
  const baseUrl = getApiBaseUrl();
  const session = getCloudSession();
  if (!isCloudConfigured() || !isLoggedIn() || !session?.accessToken) return null;

  const url = new URL(`${baseUrl}/nutrition/usda/search`);
  url.searchParams.set("q", query.trim());
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${session.accessToken}`
    }
  });
  if (!response.ok) {
    if (response.status === 503) return null;
    throw new Error("No se pudo consultar USDA desde el backend.");
  }
  return response.json();
}

async function searchDirectUsda({ query, apiKey }) {
  const key = apiKey || "DEMO_KEY";
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", key);
  url.searchParams.set("query", query.trim());
  url.searchParams.set("pageSize", "12");
  url.searchParams.set("dataType", "Foundation,SR Legacy,Survey (FNDDS),Branded");
  const response = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!response.ok) {
    if (response.status === 429) throw new Error("USDA ha limitado temporalmente la API key o DEMO_KEY. Prueba más tarde o configura USDA_API_KEY en Railway.");
    throw new Error("No se pudo consultar USDA FoodData Central.");
  }
  return response.json();
}

export async function searchUsdaFoodData({ query, apiKey }) {
  if (!query?.trim()) throw new Error("Introduce un alimento para buscar.");
  const backendResult = await searchViaBackend(query);
  if (backendResult) return backendResult;
  return searchDirectUsda({ query, apiKey });
}

export function nutritionProfileFromUsdaFood(food, ingredientId) {
  const nutrients = food.foodNutrients || [];
  const find = (...names) => {
    const item = nutrients.find(n => names.some(name => String(n.nutrientName || n.name || "").toLowerCase().includes(name)));
    return Number(item?.value ?? item?.amount ?? 0) || 0;
  };
  return {
    ingredientId,
    per: 100,
    unit: "g",
    kcal: find("energy"),
    carbs: find("carbohydrate"),
    protein: find("protein"),
    fat: find("total lipid", "fat"),
    fiber: find("fiber"),
    sugar: find("sugars"),
    sodium: find("sodium") / 1000,
    source: "usda-fooddata-central",
    fdcId: food.fdcId
  };
}
