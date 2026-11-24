import { convertUnitQuantity, roundCurrency } from './js/common.js';

// === CONFIGURATION RENTABILITÉ GLOBALE (Modifiable par l'utilisateur) ===
let VAT_RATE = 0.10;
let CHARGED_HOURLY_RATE = 22.00;
let OVERHEAD_RATE = 0.10;
let TARGET_NET_MARGIN = 0.25;

function parseStoredSetting(key, defaultValue, min = 0, max = Infinity) {
  if (typeof localStorage === 'undefined') return defaultValue;
  const raw = localStorage.getItem(key);
  if (raw === null || raw === '') return defaultValue;
  const parsed = parseFloat(raw);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(max, Math.max(min, parsed));
}

function updateGlobalSettings() {
  VAT_RATE = parseStoredSetting('settings-vat-rate', 10, 0, 100) / 100;
  CHARGED_HOURLY_RATE = parseStoredSetting('settings-charged-hourly-rate', 22, 0, 10000);
  OVERHEAD_RATE = parseStoredSetting('settings-overhead-rate', 10, 0, 100) / 100;
  TARGET_NET_MARGIN = parseStoredSetting('settings-target-net-margin', 25, 0, 99) / 100;
}

function getGlobalSettings() {
  return {
    vatRate: roundCurrency(VAT_RATE * 100),
    chargedHourlyRate: roundCurrency(CHARGED_HOURLY_RATE),
    overheadRate: roundCurrency(OVERHEAD_RATE * 100),
    targetNetMargin: roundCurrency(TARGET_NET_MARGIN * 100)
  };
}

function applyGlobalSettings(settings) {
  if (!settings || typeof settings !== 'object') return true;
  if (typeof localStorage !== 'undefined') {
    const keys = [
      'settings-vat-rate',
      'settings-charged-hourly-rate',
      'settings-overhead-rate',
      'settings-target-net-margin'
    ];
    const prev = new Map(keys.map(k => [k, localStorage.getItem(k)]));
    try {
      const saveNum = (key, value, min, max) => {
        const parsed = parseFloat(value);
        if (Number.isFinite(parsed)) {
          const clamped = Math.min(max, Math.max(min, parsed));
          localStorage.setItem(key, String(clamped));
        }
      };
      if (settings.vatRate !== undefined) saveNum('settings-vat-rate', settings.vatRate, 0, 100);
      if (settings.chargedHourlyRate !== undefined) saveNum('settings-charged-hourly-rate', settings.chargedHourlyRate, 0, 10000);
      if (settings.overheadRate !== undefined) saveNum('settings-overhead-rate', settings.overheadRate, 0, 100);
      if (settings.targetNetMargin !== undefined) saveNum('settings-target-net-margin', settings.targetNetMargin, 0, 99);
    } catch (error) {
      // Restaurer les paramètres précédents en cas d'erreur de quota
      prev.forEach((val, k) => {
        try {
          if (val === null) localStorage.removeItem(k);
          else localStorage.setItem(k, val);
        } catch (_) {}
      });
      console.error('[Storage] Erreur lors de la sauvegarde des paramètres :', error);
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new CustomEvent('data-save-error', { detail: { error } }));
        } catch (_) {}
      }
      updateGlobalSettings();
      return false;
    }
  }
  updateGlobalSettings();
  return true;
}

// Initialiser les paramètres globaux dès le chargement du module
updateGlobalSettings();

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
  { id: 1, name: 'Farine T55', price: 0.0012, unit: 'g', family: 'Épicerie', subfamily: 'Sec', yield: 100, allergens: ['gluten'] },
  { id: 2, name: 'Oeuf', price: 0.25, unit: 'pièce', family: 'Crèmerie', subfamily: '', yield: 100, allergens: ['eggs'] },
  { id: 3, name: 'Sucre', price: 0.0015, unit: 'g', family: 'Épicerie', subfamily: 'Sec', yield: 100, allergens: [] },
  { id: 4, name: 'Beurre', price: 0.008, unit: 'g', family: 'Crèmerie', subfamily: '', yield: 100, allergens: ['milk'] },
  { id: 5, name: 'Chocolat noir 70%', price: 0.015, unit: 'g', family: 'Épicerie', subfamily: 'Pâtisserie', yield: 100, allergens: ['milk', 'soybeans'] },
  { id: 6, name: 'Lait entier', price: 1.10, unit: 'L', family: 'Crèmerie', subfamily: '', yield: 100, allergens: ['milk'] },
  { id: 7, name: 'Tomate', price: 0.0025, unit: 'g', family: 'Légumerie', subfamily: 'Légumes fruits', yield: 90, allergens: [] },
  { id: 8, name: 'Oignon', price: 0.0013, unit: 'g', family: 'Légumerie', subfamily: 'Légumes racines', yield: 85, allergens: [] },
  { id: 9, name: 'Huile d\'olive', price: 9.50, unit: 'L', family: 'Épicerie', subfamily: 'Huiles et vinaigres', yield: 100, allergens: [] },
  { id: 10, name: 'Sel fin', price: null, unit: 'g', family: 'Épicerie', subfamily: 'Condiments', yield: 100, allergens: [] },
  { id: 11, name: 'Ail', price: 0.005, unit: 'g', family: 'Légumerie', subfamily: 'Condiments', yield: 80, allergens: [] },
  // Denrées de simulation
  { id: 12, name: 'Poitrine de porc', price: 0.00655, unit: 'g', family: 'Boucherie', subfamily: 'Porc', yield: 90, allergens: [] },
  { id: 13, name: 'Carotte', price: 0.002, unit: 'g', family: 'Légumerie', subfamily: 'Légumes', yield: 80, allergens: [] },
  { id: 14, name: 'Vermicelles de soja', price: 0.0093, unit: 'g', family: 'Épicerie', subfamily: 'Sec', yield: 100, allergens: [] },
  { id: 15, name: 'Champignons noirs', price: 0.015, unit: 'g', family: 'Épicerie', subfamily: 'Sec', yield: 100, allergens: [] },
  { id: 16, name: 'Sauce huîtres PANDA', price: 4.80, unit: 'L', family: 'Épicerie', subfamily: 'Condiments', yield: 100, allergens: ['molluscs'] },
  { id: 17, name: 'Huile de sésame', price: 15.00, unit: 'L', family: 'Épicerie', subfamily: 'Condiments', yield: 100, allergens: ['sesame'] },
  { id: 18, name: 'Poivre blanc moulu', price: 0.02, unit: 'g', family: 'Épicerie', subfamily: 'Épices', yield: 100, allergens: [] },
  { id: 19, name: 'Galettes de riz 22CM (lot de 35)', price: 3.90, unit: 'lot', family: 'Épicerie', subfamily: 'Sec', yield: 100, allergens: [] }
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
  },
  {
    id: 4,
    name: 'Nems Kim Chi Pho (100 portions)',
    servings: 100,
    multiplier: 3.2,
    productionTime: 120,
    steps: "Préparer la farce en mélangeant tous les ingrédients hachés, hydrater les champignons noirs et les vermicelles de soja avant de les incorporer, assaisonner avec la sauce huîtres, l'huile de sésame, le sel, le sucre et le poivre blanc, rouler dans les galettes de riz réhydratées, puis frire en deux bains.",
    ingredients: [
      { ingredientId: 12, quantity: 2500 }, // Poitrine de porc (2.5 kg)
      { ingredientId: 13, quantity: 1250 }, // Carotte (1.25 kg)
      { ingredientId: 8, quantity: 1250 },  // Oignon (1.25 kg)
      { ingredientId: 14, quantity: 500 },  // Vermicelles de soja (0.5 kg)
      { ingredientId: 15, quantity: 200 },  // Champignons noirs (0.2 kg)
      { ingredientId: 2, quantity: 10 },    // Oeuf (10 pièces)
      { ingredientId: 10, quantity: 15 },   // Sel fin (15g)
      { ingredientId: 3, quantity: 33 },    // Sucre (33g)
      { ingredientId: 16, quantity: 0.135 }, // Sauce huîtres PANDA (0.135 L)
      { ingredientId: 17, quantity: 0.035 }, // Huile de sésame (0.035 L)
      { ingredientId: 18, quantity: 8 },    // Poivre blanc moulu (8g)
      { ingredientId: 19, quantity: 3 }     // Galettes de riz (3 lots)
    ]
  }
];

function getIngredientById(id) {
  return id ? mercuriale.find(ing => ing.id === parseInt(id)) : undefined;
}

function calculateRecipeCost(recipe, visitedRecipeIds = new Set()) {
  if (!recipe || !recipe.ingredients || !Array.isArray(recipe.ingredients)) return 0;
  
  // Prévenir les boucles de récursion infinie si des sous-recettes se référencent
  if (recipe.id && visitedRecipeIds.has(recipe.id)) return 0;
  const currentVisited = new Set(visitedRecipeIds);
  if (recipe.id) currentVisited.add(recipe.id);

  return recipe.ingredients.reduce((total, item) => {
    const qty = parseFloat(item?.quantity) || 0;
    if (qty <= 0) return total;

    // Cas 1 : C'est une sous-recette imbriquée
    if (item.isSubRecipe || item.type === 'subrecipe' || item.subRecipeId) {
      const subId = parseInt(item.subRecipeId || item.ingredientId, 10);
      const subRecipe = recipes.find(r => parseInt(r.id, 10) === subId);
      if (subRecipe) {
        const subRecipeServings = Math.max(1, parseFloat(subRecipe.servings) || 1);
        const subRecipeCostPerServing = calculateRecipeCost(subRecipe, currentVisited) / subRecipeServings;
        return total + (subRecipeCostPerServing * qty);
      }
      return total;
    }

    // Cas 2 : C'est un ingrédient de la Mercuriale
    const ingredient = getIngredientById(item.ingredientId);
    if (ingredient && typeof ingredient.price === 'number' && Number.isFinite(ingredient.price)) {
      // Conversion d'unités (ex: g vers kg, cl vers L)
      const recipeUnit = item.unit || ingredient.unit;
      const convertedQty = convertUnitQuantity(qty, recipeUnit, ingredient.unit);

      // Prise en compte du Rendement au Parage (%)
      const yieldPct = (typeof ingredient.yield === 'number' && ingredient.yield > 0) ? ingredient.yield : 100;
      const effectiveUnitPrice = ingredient.price / (yieldPct / 100);

      return total + (effectiveUnitPrice * convertedQty);
    }
    return total;
  }, 0);
}

/**
 * Trouve toutes les recettes qui utilisent un ingrédient donné (exclut les sous-recettes)
 * @param {number|string} ingredientId - ID de l'ingrédient
 * @returns {Array} - Liste des recettes dépendantes
 */
function getRecipesUsingIngredient(ingredientId) {
  const targetId = parseInt(ingredientId);
  if (isNaN(targetId)) return [];
  return recipes.filter(r =>
    Array.isArray(r.ingredients) &&
    r.ingredients.some(item =>
      !(item.isSubRecipe || item.type === 'subrecipe' || item.subRecipeId) &&
      parseInt(item.ingredientId) === targetId
    )
  );
}

/**
 * Trouve toutes les recettes qui utilisent une autre recette en tant que sous-recette
 * @param {number|string} recipeId - ID de la sous-recette
 * @returns {Array} - Liste des recettes parentes dépendantes
 */
function getRecipesUsingSubRecipe(recipeId) {
  const targetId = parseInt(recipeId);
  if (isNaN(targetId)) return [];
  return recipes.filter(r =>
    parseInt(r.id) !== targetId &&
    Array.isArray(r.ingredients) &&
    r.ingredients.some(item =>
      (item.isSubRecipe || item.type === 'subrecipe' || item.subRecipeId) &&
      parseInt(item.subRecipeId || item.ingredientId) === targetId
    )
  );
}

// === FONCTIONS DE CALCUL DE RENTABILITÉ (Prime Cost) ===

/**
 * Calcule le coût main d'œuvre total pour une recette
 * Basé sur le coût horaire chargé SAS (22.00 €/h par défaut)
 * @param {Object} recipe - La recette
 * @returns {number} - Coût main d'œuvre total
 */
function calculateLaborCost(recipe) {
  const timeInMinutes = Math.max(0, parseFloat(recipe?.productionTime) || 0);
  return (timeInMinutes / 60) * CHARGED_HOURLY_RATE;
}

/**
 * Calcule le coût main d'œuvre par portion
 * @param {Object} recipe - La recette
 * @returns {number} - Coût main d'œuvre par portion
 */
function calculateLaborCostPerServing(recipe) {
  const servings = parseFloat(recipe?.servings);
  if (!servings || servings <= 0) return 0;
  return calculateLaborCost(recipe) / servings;
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
  const servings = parseFloat(recipe?.servings);
  if (!servings || servings <= 0) return 0;
  const cm = calculateRecipeCost(recipe);
  const mo = calculateLaborCost(recipe);
  const fg = (cm + mo) * OVERHEAD_RATE;
  return (cm + mo + fg) / servings;
}

/**
 * Calcule le prix de vente HT actuel par portion (CM/portion × multiplicateur)
 * @param {Object} recipe - La recette
 * @returns {number} - Prix de vente HT actuel par portion
 */
function calculateActualPriceHTPerServing(recipe) {
  const cm = calculateRecipeCost(recipe);
  const servings = parseFloat(recipe?.servings) || 1;
  if (servings <= 0) return 0;
  const multiplier = Math.max(0, parseFloat(recipe?.multiplier) || 0);
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
  if (!actualPVHT || actualPVHT <= 0) return 0;
  const margin = ((actualPVHT - costPerServing) / actualPVHT) * 100;
  return isNaN(margin) ? 0 : margin;
}

/**
 * Calcule la rentabilité horaire complémentaire (bénéfice d'entreprise net par heure)
 * Si >= 0 : le traiteur a payé ses courses, frais, et s'est versé son salaire net
 * Si < 0 : le prix de vente est trop bas
 * @param {Object} recipe - La recette
 * @returns {number} - Profit par heure de travail en €
 */
function calculateHourlyProfitability(recipe) {
  const servings = Math.max(1, parseFloat(recipe?.servings) || 1);
  const actualPVHT = calculateActualPriceHTPerServing(recipe);
  const costPerServing = calculateTotalCostPerServing(recipe);
  const totalProfit = (actualPVHT - costPerServing) * servings;
  const timeInHours = Math.max(0, parseFloat(recipe?.productionTime) || 0) / 60;
  if (timeInHours <= 0) return 0;
  const profit = totalProfit / timeInHours;
  return isNaN(profit) ? 0 : profit;
}

/**
 * Suggère un prix de vente optimal basé sur la marge nette cible
 * @param {Object} recipe - La recette
 * @param {number} targetMargin - Marge nette cible (défaut: TARGET_NET_MARGIN)
 * @returns {{ht: number, ttc: number}} - Prix suggéré HT et TTC par portion
 */
function calculateSuggestedPrice(recipe, targetMargin = TARGET_NET_MARGIN) {
  const costPerServing = calculateTotalCostPerServing(recipe);
  if (costPerServing <= 0 || targetMargin >= 1) return { ht: 0, ttc: 0 };
  const suggestedHT = costPerServing / (1 - targetMargin);
  const suggestedTTC = suggestedHT * (1 + VAT_RATE);
  return {
    ht: isNaN(suggestedHT) ? 0 : suggestedHT,
    ttc: isNaN(suggestedTTC) ? 0 : suggestedTTC
  };
}

// === CALCULS DU POIDS & DU PRIX AU KILO ===

const MASS_TO_KG = {
  'g': 0.001, 'gr': 0.001, 'grs': 0.001, 'gm': 0.001, 'g.': 0.001, 'gramme': 0.001, 'grammes': 0.001,
  'kg': 1, 'kgs': 1, 'kilo': 1, 'kilos': 1, 'kg.': 1, 'kilogramme': 1, 'kilogrammes': 1,
  'mg': 0.000001, 'mgs': 0.000001, 'mg.': 0.000001
};

const VOLUME_TO_KG = {
  'ml': 0.001, 'mls': 0.001, 'ml.': 0.001, 'millilitre': 0.001, 'millilitres': 0.001,
  'cl': 0.01, 'cls': 0.01, 'cl.': 0.01, 'centilitre': 0.01, 'centilitres': 0.01,
  'dl': 0.1, 'dls': 0.1, 'dl.': 0.1, 'décilitre': 0.1, 'décilitres': 0.1,
  'l': 1, 'ls': 1, 'l.': 1, 'lit': 1, 'litre': 1, 'litres': 1
};

/**
 * Calcule le poids en kg d'une ligne d'ingrédient unique.
 * Partagé entre calculateRecipeWeight() et le Bon d'économat.
 *
 * @param {Object|undefined} ingredient - La denrée issue de la mercuriale
 * @param {number|string} quantity - Quantité dans l'unité d'utilisation
 * @param {string} [unit] - Unité d'utilisation (défaut: ingredient.unit)
 * @returns {{ weightKg: number, volumeApproxUsed: boolean, excluded: boolean }}
 */
function calculateIngredientWeightKg(ingredient, quantity, unit) {
  const qty = typeof quantity === 'number' && Number.isFinite(quantity) ? quantity : (parseFloat(quantity) || 0);
  if (qty <= 0) {
    return { weightKg: 0, volumeApproxUsed: false, excluded: false };
  }
  if (!ingredient) {
    return { weightKg: 0, volumeApproxUsed: false, excluded: true };
  }

  const rawUnit = unit || ingredient.unit || '';
  const normalizedUnit = String(rawUnit).toLowerCase().trim();

  if (MASS_TO_KG[normalizedUnit] !== undefined) {
    return { weightKg: qty * MASS_TO_KG[normalizedUnit], volumeApproxUsed: false, excluded: false };
  }
  if (VOLUME_TO_KG[normalizedUnit] !== undefined) {
    return { weightKg: qty * VOLUME_TO_KG[normalizedUnit], volumeApproxUsed: true, excluded: false };
  }
  if (typeof ingredient.weightKg === 'number' && Number.isFinite(ingredient.weightKg) && ingredient.weightKg > 0) {
    const convertedQty = convertUnitQuantity(qty, rawUnit, ingredient.unit);
    return { weightKg: convertedQty * ingredient.weightKg, volumeApproxUsed: false, excluded: false };
  }
  return { weightKg: 0, volumeApproxUsed: false, excluded: true };
}

/**
 * Calcule le poids total en kilogrammes (kg) d'une recette
 * Prend en compte :
 *  - Les unités de masse (kg, g, mg...)
 *  - Les unités de volume avec densité culinaire standard 1 L ≈ 1 kg (L, cl, ml, dl...)
 *  - Les denrées unitaires/conditionnées ayant un poids brut par unité renseigné dans la Mercuriale (weightKg)
 *  - Les sous-recettes imbriquées de façon récursive avec protection anti-boucle infinie
 * 
 * @param {Object} recipe - La recette
 * @param {Set} [visitedRecipeIds=new Set()] - Set de détection des cycles de sous-recettes
 * @returns {{ totalWeightKg: number, excludedCount: number, volumeApproxUsed: boolean, isComplete: boolean }}
 */
function calculateRecipeWeight(recipe, visitedRecipeIds = new Set()) {
  if (!recipe || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    return { totalWeightKg: 0, excludedCount: 0, volumeApproxUsed: false, isComplete: true };
  }

  if (recipe.id && visitedRecipeIds.has(recipe.id)) {
    return { totalWeightKg: 0, excludedCount: 0, volumeApproxUsed: false, isComplete: true };
  }
  const currentVisited = new Set(visitedRecipeIds);
  if (recipe.id) currentVisited.add(recipe.id);

  let totalWeightKg = 0;
  let excludedCount = 0;
  let volumeApproxUsed = false;

  for (const item of recipe.ingredients) {
    const qty = parseFloat(item.quantity) || 0;
    if (qty <= 0) continue;

    // Cas 1 : Sous-recette imbriquée
    if (item.isSubRecipe || item.type === 'subrecipe' || item.subRecipeId) {
      const subId = parseInt(item.subRecipeId || item.ingredientId, 10);
      const subRecipe = recipes.find(r => parseInt(r.id, 10) === subId);
      if (subRecipe) {
        const subServings = Math.max(1, parseFloat(subRecipe.servings) || 1);
        const subRes = calculateRecipeWeight(subRecipe, currentVisited);
        const subWeightPerServing = subRes.totalWeightKg / subServings;
        totalWeightKg += subWeightPerServing * qty;
        excludedCount += subRes.excludedCount;
        if (subRes.volumeApproxUsed) volumeApproxUsed = true;
      } else {
        excludedCount++;
      }
      continue;
    }

    // Cas 2 : Ingrédient issu de la mercuriale
    const ingredient = getIngredientById(item.ingredientId);
    const weightRes = calculateIngredientWeightKg(ingredient, qty, item.unit || ingredient?.unit);
    if (weightRes.excluded) {
      excludedCount++;
    } else {
      totalWeightKg += weightRes.weightKg;
      if (weightRes.volumeApproxUsed) volumeApproxUsed = true;
    }
  }

  return {
    totalWeightKg,
    excludedCount,
    volumeApproxUsed,
    isComplete: excludedCount === 0
  };
}

/**
 * Calcule le prix de vente au kilo TTC d'une recette
 * Formule : (Prix de vente TTC × Portions) ÷ Poids total (kg)
 * 
 * @param {Object} recipe - La recette
 * @param {number|null} [totalWeightKgOverride=null] - Poids pré-calculé optionnel
 * @returns {number|null} - Prix de vente au kilo TTC, ou null si non calculable
 */
function calculateSalePricePerKgTTC(recipe, totalWeightKgOverride = null) {
  if (!recipe) return null;
  const weight = typeof totalWeightKgOverride === 'number'
    ? totalWeightKgOverride
    : calculateRecipeWeight(recipe).totalWeightKg;

  if (!weight || weight <= 0) return null;

  const servings = Math.max(1, parseFloat(recipe.servings) || 1);
  const totalCost = calculateRecipeCost(recipe);
  const costPerServing = servings > 0 ? totalCost / servings : 0;
  const multiplier = Math.max(0, parseFloat(recipe.multiplier) || 0);
  const salePriceHT = costPerServing * multiplier;
  const salePriceTTC = salePriceHT * (1 + VAT_RATE);

  // Prix de vente TTC unitaire arrondi au centime (2 décimales)
  const unitTTC = roundCurrency(salePriceTTC);

  const totalRevenueTTC = unitTTC * servings;
  const pricePerKg = totalRevenueTTC / weight;

  return isNaN(pricePerKg) || pricePerKg <= 0 ? null : pricePerKg;
}

/**
 * Calcule le prix de vente au kilo HT d'une recette
 * Formule : (Prix de vente HT × Portions) ÷ Poids total (kg)
 * 
 * @param {Object} recipe - La recette
 * @param {number|null} [totalWeightKgOverride=null] - Poids pré-calculé optionnel
 * @returns {number|null} - Prix de vente au kilo HT, ou null si non calculable
 */
function calculateSalePricePerKgHT(recipe, totalWeightKgOverride = null) {
  if (!recipe) return null;
  const weight = typeof totalWeightKgOverride === 'number'
    ? totalWeightKgOverride
    : calculateRecipeWeight(recipe).totalWeightKg;

  if (!weight || weight <= 0) return null;

  const servings = Math.max(1, parseFloat(recipe.servings) || 1);
  const totalCost = calculateRecipeCost(recipe);
  const costPerServing = servings > 0 ? totalCost / servings : 0;
  const multiplier = Math.max(0, parseFloat(recipe.multiplier) || 0);
  const salePriceHT = costPerServing * multiplier;

  // Prix de vente HT unitaire arrondi au centime (2 décimales)
  const unitHT = roundCurrency(salePriceHT);

  const totalRevenueHT = unitHT * servings;
  const pricePerKg = totalRevenueHT / weight;

  return isNaN(pricePerKg) || pricePerKg <= 0 ? null : pricePerKg;
}

// === FONCTIONS ALLERGÈNES ===

/**
 * Récupère les allergènes d'une recette à partir de ses ingrédients
 * @param {Object} recipe - La recette
 * @returns {Array} - Liste des IDs d'allergènes uniques
 */
function getRecipeAllergens(recipe, visitedRecipeIds = new Set()) {
  if (!recipe || !recipe.ingredients || !Array.isArray(recipe.ingredients)) return [];
  if (recipe.id && visitedRecipeIds.has(recipe.id)) return [];
  const currentVisited = new Set(visitedRecipeIds);
  if (recipe.id) currentVisited.add(recipe.id);

  const allergenSet = new Set();
  recipe.ingredients.forEach(item => {
    if (item.isSubRecipe || item.type === 'subrecipe' || item.subRecipeId) {
      const subId = parseInt(item.subRecipeId || item.ingredientId, 10);
      const subRecipe = recipes.find(r => parseInt(r.id, 10) === subId);
      if (subRecipe) {
        const subAllergens = getRecipeAllergens(subRecipe, currentVisited);
        subAllergens.forEach(a => allergenSet.add(a));
      }
    } else {
      const ingredient = getIngredientById(item.ingredientId);
      if (ingredient && Array.isArray(ingredient.allergens)) {
        ingredient.allergens.forEach(a => allergenSet.add(a));
      }
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

// Persistance locale des données avec gestion d'erreur de quota et rollback atomique
function saveData(recipesToSave = recipes, mercurialeToSave = mercuriale) {
  if (typeof localStorage !== 'undefined') {
    const prevRecipes = localStorage.getItem('culinary-recipes');
    const prevMercuriale = localStorage.getItem('culinary-mercuriale');
    try {
      localStorage.setItem('culinary-recipes', JSON.stringify(recipesToSave));
      localStorage.setItem('culinary-mercuriale', JSON.stringify(mercurialeToSave));
    } catch (error) {
      // Rollback pour éviter un état incohérent dans localStorage
      try {
        if (prevRecipes === null) localStorage.removeItem('culinary-recipes');
        else localStorage.setItem('culinary-recipes', prevRecipes);
        if (prevMercuriale === null) localStorage.removeItem('culinary-mercuriale');
        else localStorage.setItem('culinary-mercuriale', prevMercuriale);
      } catch (_) {}
      console.error('[Storage] Erreur lors de la sauvegarde dans localStorage :', error);
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new CustomEvent('data-save-error', { detail: { error } }));
        } catch (_) {}
      }
      return false;
    }
  }
  if (typeof window !== 'undefined') {
    try {
      const detail = { recipes: recipesToSave, mercuriale: mercurialeToSave };
      window.dispatchEvent(new CustomEvent('data-saved', { detail }));
    } catch (_) {
      // Ignore if CustomEvent not available
    }
  }
  return true;
}

function loadData() {
  if (typeof localStorage === 'undefined') return;
  const savedRecipes = localStorage.getItem('culinary-recipes');
  const savedMercuriale = localStorage.getItem('culinary-mercuriale');
  if (savedRecipes) {
    try {
      const parsed = JSON.parse(savedRecipes);
      if (Array.isArray(parsed)) {
        recipes.splice(0, recipes.length, ...parsed);
      }
    } catch (_) {}
  }
  if (savedMercuriale) {
    try {
      const parsed = JSON.parse(savedMercuriale);
      if (Array.isArray(parsed)) {
        mercuriale.splice(0, mercuriale.length, ...parsed);
      }
    } catch (_) {}
  }

  // Détection non destructive d'éventuelles anomalies de saisie d'unité
  auditAndRepairRecipes(recipes, mercuriale);
}

/**
 * Détecte de façon strictement non destructive les quantités potentiellement suspectes
 * (ex: ingrédient acheté au kg saisi à < 1 g). Ne modifie jamais les données utilisateur.
 * @returns {Array<{ recipeId: number, recipeName: string, ingredientName: string, quantity: number, unit: string, buyUnit: string }>}
 */
function auditAndRepairRecipes(recipesList, mercurialeList) {
  const warnings = [];
  if (!Array.isArray(recipesList) || !Array.isArray(mercurialeList)) return warnings;
  const mercMap = new Map(mercurialeList.map(m => [m.id, m]));

  recipesList.forEach(recipe => {
    (recipe.ingredients || []).forEach(item => {
      if (item.isSubRecipe || item.type === 'subrecipe' || item.subRecipeId) return;
      const ing = mercMap.get(item.ingredientId);
      if (!ing) return;

      const buyUnit = String(ing.unit || '').toLowerCase().trim();
      const useUnit = String(item.unit || '').toLowerCase().trim();
      const qty = parseFloat(item.quantity);

      if (
        (buyUnit === 'kg' && useUnit === 'g' && qty > 0 && qty < 1) ||
        (buyUnit === 'l' && (useUnit === 'ml' || useUnit === 'cl') && qty > 0 && qty < 1)
      ) {
        const warning = {
          recipeId: recipe.id,
          recipeName: recipe.name,
          ingredientName: ing.name,
          quantity: qty,
          unit: item.unit,
          buyUnit: ing.unit
        };
        warnings.push(warning);
        console.warn(`[Audit] Quantité très faible détectée pour "${ing.name}" dans "${recipe.name}": ${qty} ${item.unit} (unité d'achat : ${ing.unit}). Aucune modification automatique appliquée.`);
      }
    });
  });

  return warnings;
}

function isDataLoaded() {
  if (typeof localStorage === 'undefined') return false;
  return !!localStorage.getItem('culinary-mercuriale') || !!localStorage.getItem('culinary-recipes');
}

// Charger les données au démarrage si elles existent.
// Sinon, on attend l'interaction de l'utilisateur sur la modale de première visite.
if (isDataLoaded()) {
  loadData();
}

function setData(newData) {
  if (newData && Array.isArray(newData.recipes) && Array.isArray(newData.mercuriale)) {
    const prevRecipes = [...recipes];
    const prevMercuriale = [...mercuriale];
    const prevSettings = getGlobalSettings();

    if (!saveData(newData.recipes, newData.mercuriale)) {
      return false;
    }
    if (newData.settings && typeof newData.settings === 'object') {
      if (!applyGlobalSettings(newData.settings)) {
        // Restaurer les données précédentes si la sauvegarde des paramètres échoue
        saveData(prevRecipes, prevMercuriale);
        applyGlobalSettings(prevSettings);
        return false;
      }
    }
    recipes.splice(0, recipes.length, ...newData.recipes);
    mercuriale.splice(0, mercuriale.length, ...newData.mercuriale);
    auditAndRepairRecipes(recipes, mercuriale);
    return true;
  }
  return false;
}

// === GÉNÉRATION D'IDS SÛRS (auto-incrémentés) ===
function nextRecipeId() {
  if (!Array.isArray(recipes) || recipes.length === 0) return 1;
  const maxId = recipes.reduce((max, r) => {
    const id = parseInt(r?.id);
    return !isNaN(id) && id > max ? id : max;
  }, 0);
  return maxId + 1;
}

function nextIngredientId() {
  if (!Array.isArray(mercuriale) || mercuriale.length === 0) return 1;
  const maxId = mercuriale.reduce((max, ing) => {
    const id = parseInt(ing?.id);
    return !isNaN(id) && id > max ? id : max;
  }, 0);
  return maxId + 1;
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
  updateGlobalSettings,
  getGlobalSettings,
  applyGlobalSettings,
  // Fonctions de base
  getIngredientById,
  getRecipesUsingIngredient,
  getRecipesUsingSubRecipe,
  calculateRecipeCost,
  saveData,
  loadData,
  isDataLoaded,
  setData,
  auditAndRepairRecipes,
  // Fonctions de rentabilité & pricing
  calculateLaborCost,
  calculateLaborCostPerServing,
  calculateOverheadCost,
  calculateTotalCostPerServing,
  calculateActualPriceHTPerServing,
  calculateNetMargin,
  calculateHourlyProfitability,
  calculateSuggestedPrice,
  // Fonctions poids et prix au kilo
  calculateIngredientWeightKg,
  calculateRecipeWeight,
  calculateSalePricePerKgTTC,
  calculateSalePricePerKgHT,
  // Fonctions allergènes
  getRecipeAllergens,
  getRecipeAllergenDetails,
  ingredientHasAllergen,
  // Utilitaires ID
  nextRecipeId,
  nextIngredientId
};