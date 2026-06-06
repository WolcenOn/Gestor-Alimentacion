export async function searchUsdaFoodData({ query, apiKey }) {
  const key = apiKey || "DEMO_KEY";
  if (!query?.trim()) throw new Error("Introduce un alimento para buscar.");
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", key);
  url.searchParams.set("query", query.trim());
  url.searchParams.set("pageSize", "12");
  url.searchParams.set("dataType", "Foundation,SR Legacy,Survey (FNDDS),Branded");
  const response = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!response.ok) {
    if (response.status === 429) throw new Error("USDA ha limitado temporalmente la API key o DEMO_KEY. Prueba más tarde o usa una clave propia en Ajustes.");
    throw new Error("No se pudo consultar USDA FoodData Central.");
  }
  return response.json();
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
