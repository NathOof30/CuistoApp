const VAT_RATE = 0.10; // 10%

// === CONFIGURATION RENTABILITÉ (Modèle Prime Cost — SAS) ===
// Coût horaire chargé SAS : 15.00 € net × 1.82 (charges salariales + patronales)
const CHARGED_HOURLY_RATE = 27.30;
const OVERHEAD_RATE = 0.10;       // 10% du Prime Cost (CM + MO)
const TARGET_NET_MARGIN = 0.25;   // Marge nette cible (25%)

// === 14 ALLERGÈNES RÉGLEMENTAIRES UE (Règlement UE 1169/2011) ===
const EU_ALLERGENS = [
  { id: 'gluten', name: 'Gluten', description: 'Céréales contenant du gluten (blé, seigle, orge, avoine, épeautre, kamut)', icon: '🌾' },
  { id: 'crustaceans', name: 'Crustacés', description: 'Crustacés et produits à base de crustacés', icon: '🦐' },
  { id: 'eggs', name: 'Œufs', description: 'Œufs et produits à base d\'œufs', icon: '🥚' },
  { id: 'fish', name: 'Poisson', description: 'Poissons et produits à base de poissons', icon: '🐟' },
  { id: 'peanuts', name: 'Arachides', description: 'Arachides et produits à base d\'arachides', icon: '🥜' },
  { id: 'soybeans', name: 'Soja', description: 'Soja et produits à base de soja', icon: '🫘' },
  { id: 'milk', name: 'Lait', description: 'Lait et produits à base de lait (y compris le lactose)', icon: '🥛' },
  { id: 'nuts', name: 'Fruits à coque', description: 'Amandes, noisettes, noix, noix de cajou, noix de pécan, noix du Brésil, pistaches, noix de macadamia', icon: '🌰' },
  { id: 'celery', name: 'Céleri', description: 'Céleri et produits à base de céleri', icon: '🥬' },
  { id: 'mustard', name: 'Moutarde', description: 'Moutarde et produits à base de moutarde', icon: '🟡' },
  { id: 'sesame', name: 'Sésame', description: 'Graines de sésame et produits à base de graines de sésame', icon: '⚪' },
  { id: 'sulphites', name: 'Sulfites', description: 'Anhydride sulfureux et sulfites (> 10 mg/kg ou 10 mg/L)', icon: '🍷' },
  { id: 'lupin', name: 'Lupin', description: 'Lupin et produits à base de lupin', icon: '🌸' },
  { id: 'molluscs', name: 'Mollusques', description: 'Mollusques et produits à base de mollusques', icon: '🦪' }
];

let mercuriale = [
  { id: 1, name: 'Farine T55', price: 0.0012, unit: 'g', family: 'Épicerie', subfamily: 'Sec', allergens: ['gluten'] },
  { id: 2, name: 'Oeuf', price: 0.25, unit: 'pièce', family: 'Crèmerie', subfamily: '', allergens: ['eggs'] },
  { id: 3, name: 'Sucre', price: 0.0015, unit: 'g', family: 'Épicerie', subfamily: 'Sec', allergens: [] },
  { id: 4, name: 'Beurre', price: 0.008, unit: 'g', family: 'Crèmerie', subfamily: '', allergens: ['milk'] },
  { id: 5, name: 'Chocolat noir 70%', price: 0.015, unit: 'g', family: 'Épicerie', subfamily: 'Pâtisserie', allergens: ['milk', 'soybeans'] },
  { id: 6, name: 'Lait entier', price: 1.10, unit: 'L', family: 'Crèmerie', subfamily: '', allergens: ['milk'] },
  { id: 7, name: 'Tomate', price: 0.0025, unit: 'g', family: 'Légumerie', subfamily: 'Légumes fruits', allergens: [] },
  { id: 8, name: 'Oignon', price: 0.0013, unit: 'g', family: 'Légumerie', subfamily: 'Légumes racines', allergens: [] },
  { id: 9, name: 'Huile d\'olive', price: 9.50, unit: 'L', family: 'Épicerie', subfamily: 'Huiles et vinaigres', allergens: [] },
  { id: 10, name: 'Sel fin', price: null, unit: 'g', family: 'Épicerie', subfamily: 'Condiments', allergens: [] },
  { id: 11, name: 'Ail', price: 0.005, unit: 'g', family: 'Légumerie', subfamily: 'Condiments', allergens: [] },
];

let recipes = [
  {
    id: 1,
    name: 'Mousse au chocolat',
    servings: 6,
    multiplier: 3.5,
    productionTime: 30, // Temps de production en minutes
    steps: "Fondre le chocolat, battre les oeufs, incorporer le sucre, monter en neige et mélanger délicatement.",
    ingredients: [
      { ingredientId: 5, quantity: 200 },
      { ingredientId: 2, quantity: 4 },
      { ingredientId: 3, quantity: 50 }
    ]
  },
  {
    id: 2,
    name: 'Sauce tomate maison',
    servings: 4,
    multiplier: 4,
    productionTime: 45, // Temps de production en minutes
    steps: "Faire revenir l'oignon, ajouter la tomate, laisser mijoter, assaisonner.",
    ingredients: [
      { ingredientId: 7, quantity: 1000 },
      { ingredientId: 8, quantity: 200 },
      { ingredientId: 9, quantity: 0.05 },
      { ingredientId: 10, quantity: 10 },
      { ingredientId: 11, quantity: 20 }
    ]
  },
  {
    id: 3,
    name: 'Crêpes',
    servings: 8,
    multiplier: 4.5,
    productionTime: 20, // Temps de production en minutes
    steps: "",
    ingredients: [
      { ingredientId: 1, quantity: 250 },
      { ingredientId: 2, quantity: 4 },
      { ingredientId: 6, quantity: 0.5 },
      { ingredientId: 3, quantity: 100 }
    ]
  }
];

function getIngredientById(id) {
  return id ? mercuriale.find(ing => ing.id === parseInt(id)) : undefined;
}

function calculateRecipeCost(recipe) {
  if (!recipe || !recipe.ingredients) return 0;
  return recipe.ingredients.reduce((total, item) => {
    const ingredient = getIngredientById(item.ingredientId);
    if (ingredient && ingredient.price !== null && ingredient.price !== undefined && item.quantity) {
      return total + (ingredient.price * item.quantity);
    }
    return total;
  }, 0);
}

// === FONCTIONS DE CALCUL DE RENTABILITÉ (Prime Cost) ===

/**
 * Calcule le coût main d'œuvre total pour une recette
 * Basé sur le coût horaire chargé SAS (27.30 €/h)
 * @param {Object} recipe - La recette
 * @returns {number} - Coût main d'œuvre total
 */
function calculateLaborCost(recipe) {
  const timeInMinutes = recipe?.productionTime || 0;
  return (timeInMinutes / 60) * CHARGED_HOURLY_RATE;
}

/**
 * Calcule le coût main d'œuvre par portion
 * @param {Object} recipe - La recette
 * @returns {number} - Coût main d'œuvre par portion
 */
function calculateLaborCostPerServing(recipe) {
  if (!recipe?.servings || recipe.servings <= 0) return 0;
  return calculateLaborCost(recipe) / recipe.servings;
}

/**
 * Calcule les frais généraux (10% du Prime Cost = CM + MO)
 * @param {Object} recipe - La recette
 * @returns {number} - Frais généraux totaux
 */
function calculateOverheadCost(recipe) {
  const cm = calculateRecipeCost(recipe);
  const mo = calculateLaborCost(recipe);
  return (cm + mo) * OVERHEAD_RATE;
}

/**
 * Calcule le coût de production complet par portion (CM + MO + FG) / portions
 * @param {Object} recipe - La recette
 * @returns {number} - Coût complet par portion
 */
function calculateTotalCostPerServing(recipe) {
  if (!recipe?.servings || recipe.servings <= 0) return 0;
  const cm = calculateRecipeCost(recipe);
  const mo = calculateLaborCost(recipe);
  const fg = (cm + mo) * OVERHEAD_RATE;
  return (cm + mo + fg) / recipe.servings;
}

/**
 * Calcule le prix de vente HT actuel par portion (CM/portion × multiplicateur)
 * @param {Object} recipe - La recette
 * @returns {number} - Prix de vente HT actuel par portion
 */
function calculateActualPriceHTPerServing(recipe) {
  const cm = calculateRecipeCost(recipe);
  const servings = recipe?.servings || 1;
  const multiplier = recipe?.multiplier || 1;
  return (cm / servings) * multiplier;
}

/**
 * Calcule la marge nette réelle après soustraction de toutes les charges
 * @param {Object} recipe - La recette
 * @returns {number} - Marge nette en pourcentage
 */
function calculateNetMargin(recipe) {
  const actualPVHT = calculateActualPriceHTPerServing(recipe);
  const costPerServing = calculateTotalCostPerServing(recipe);
  if (actualPVHT === 0) return 0;
  return ((actualPVHT - costPerServing) / actualPVHT) * 100;
}

/**
 * Calcule la rentabilité horaire complémentaire (bénéfice d'entreprise net par heure)
 * Si >= 0 : le traiteur a payé ses courses, frais, et s'est versé 15€/h net
 * Si < 0 : le prix de vente est trop bas
 * @param {Object} recipe - La recette
 * @returns {number} - Profit par heure de travail en €
 */
function calculateHourlyProfitability(recipe) {
  const servings = recipe?.servings || 1;
  const actualPVHT = calculateActualPriceHTPerServing(recipe);
  const costPerServing = calculateTotalCostPerServing(recipe);
  const totalProfit = (actualPVHT - costPerServing) * servings;
  const timeInHours = (recipe?.productionTime || 0) / 60;
  if (timeInHours === 0) return 0;
  return totalProfit / timeInHours;
}

/**
 * Suggère un prix de vente optimal basé sur la marge nette cible
 * @param {Object} recipe - La recette
 * @param {number} targetMargin - Marge nette cible (défaut: TARGET_NET_MARGIN)
 * @returns {{ht: number, ttc: number}} - Prix suggéré HT et TTC par portion
 */
function calculateSuggestedPrice(recipe, targetMargin = TARGET_NET_MARGIN) {
  const costPerServing = calculateTotalCostPerServing(recipe);
  if (costPerServing <= 0) return { ht: 0, ttc: 0 };
  const suggestedHT = costPerServing / (1 - targetMargin);
  const suggestedTTC = suggestedHT * (1 + VAT_RATE);
  return { ht: suggestedHT, ttc: suggestedTTC };
}

// === FONCTIONS ALLERGÈNES ===

/**
 * Récupère les allergènes d'une recette à partir de ses ingrédients
 * @param {Object} recipe - La recette
 * @returns {Array} - Liste des IDs d'allergènes uniques
 */
function getRecipeAllergens(recipe) {
  if (!recipe || !recipe.ingredients) return [];
  const allergenSet = new Set();
  recipe.ingredients.forEach(item => {
    const ingredient = getIngredientById(item.ingredientId);
    if (ingredient && Array.isArray(ingredient.allergens)) {
      ingredient.allergens.forEach(a => allergenSet.add(a));
    }
  });
  return [...allergenSet];
}

/**
 * Récupère les détails des allergènes d'une recette
 * @param {Object} recipe - La recette
 * @returns {Array} - Liste des objets allergènes avec détails
 */
function getRecipeAllergenDetails(recipe) {
  const allergenIds = getRecipeAllergens(recipe);
  return EU_ALLERGENS.filter(a => allergenIds.includes(a.id));
}

/**
 * Vérifie si un ingrédient contient un allergène spécifique
 * @param {number} ingredientId - ID de l'ingrédient
 * @param {string} allergenId - ID de l'allergène
 * @returns {boolean}
 */
function ingredientHasAllergen(ingredientId, allergenId) {
  const ingredient = getIngredientById(ingredientId);
  return ingredient && Array.isArray(ingredient.allergens) && ingredient.allergens.includes(allergenId);
}

// Pour simuler la persistance des données
function saveData(recipesToSave = recipes, mercurialeToSave = mercuriale) {
  localStorage.setItem('culinary-recipes', JSON.stringify(recipesToSave));
  localStorage.setItem('culinary-mercuriale', JSON.stringify(mercurialeToSave));
  try {
    const detail = { recipes: recipesToSave, mercuriale: mercurialeToSave };
    window.dispatchEvent(new CustomEvent('data-saved', { detail }));
  } catch (_) {
    // Ignore if CustomEvent not available
  }
}

function loadData() {
  const savedRecipes = localStorage.getItem('culinary-recipes');
  const savedMercuriale = localStorage.getItem('culinary-mercuriale');
  if (savedRecipes) {
    recipes = JSON.parse(savedRecipes);
  }
  if (savedMercuriale) {
    mercuriale = JSON.parse(savedMercuriale);
  }
}

function isDataLoaded() {
  return !!localStorage.getItem('culinary-mercuriale') || !!localStorage.getItem('culinary-recipes');
}

// Charger les données au démarrage si elles existent.
// Sinon, on attend l'interaction de l'utilisateur sur la modale de première visite.
if (isDataLoaded()) {
  loadData();
}

function setData(newData) {
  if (newData && Array.isArray(newData.recipes) && Array.isArray(newData.mercuriale)) {
    recipes = newData.recipes;
    mercuriale = newData.mercuriale;
    saveData(recipes, mercuriale);
    return true;
  }
  return false;
}

// === GÉNÉRATION D'IDS SÛRS (auto-incrémentés) ===
function nextRecipeId() {
  return recipes.length > 0 ? Math.max(...recipes.map(r => r.id)) + 1 : 1;
}

function nextIngredientId() {
  return mercuriale.length > 0 ? Math.max(...mercuriale.map(i => i.id)) + 1 : 1;
}

export {
  // Données
  mercuriale,
  recipes,
  EU_ALLERGENS,
  // Configuration
  VAT_RATE,
  CHARGED_HOURLY_RATE,
  OVERHEAD_RATE,
  TARGET_NET_MARGIN,
  // Fonctions de base
  getIngredientById,
  calculateRecipeCost,
  saveData,
  isDataLoaded,
  setData,
  // Fonctions de rentabilité
  calculateLaborCost,
  calculateLaborCostPerServing,
  calculateOverheadCost,
  calculateTotalCostPerServing,
  calculateActualPriceHTPerServing,
  calculateNetMargin,
  calculateHourlyProfitability,
  calculateSuggestedPrice,
  // Fonctions allergènes
  getRecipeAllergens,
  getRecipeAllergenDetails,
  ingredientHasAllergen,
  // Utilitaires ID
  nextRecipeId,
  nextIngredientId
};