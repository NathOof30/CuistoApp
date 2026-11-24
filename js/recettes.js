import {
    mercuriale, recipes, VAT_RATE, CHARGED_HOURLY_RATE, OVERHEAD_RATE, TARGET_NET_MARGIN,
    getIngredientById, getRecipesUsingSubRecipe, calculateRecipeCost, saveData,
    EU_ALLERGENS,
    calculateLaborCostPerServing, calculateTotalCostPerServing,
    calculateActualPriceHTPerServing,
    calculateNetMargin, calculateHourlyProfitability, calculateSuggestedPrice,
    calculateRecipeWeight, calculateSalePricePerKgTTC,
    getRecipeAllergens, getRecipeAllergenDetails, nextRecipeId
} from '../data.js';
import {
    formatCurrency, formatCurrency3, formatUnitPrice, formatPercent, formatRate,
    formatDecimalFactor, formatDuration, escapeHTML, formatQuantityInput,
    convertUnitQuantity, convertQuantityBetweenUnits, getCompatibleUnits
} from './common.js';
import { showToast, showConfirm } from './ui-feedback.js';

let currentSortColumn = 'name';
let currentSortDirection = 'asc';

export function initRecettesPage() {
    const searchInput = document.getElementById('search-recipe');
    const addRecipeBtn = document.getElementById('add-recipe-btn');
    const modal = document.getElementById('recipe-modal');

    renderRecipesTable();

    if (searchInput) {
        searchInput.addEventListener('input', () => renderRecipesTable());
    }

    addRecipeBtn.addEventListener('click', () => showRecipeModal());

    // Hook up sorting click handlers on all sortable headers
    document.querySelectorAll('#recipes-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const sortKey = th.dataset.sort;
            if (currentSortColumn === sortKey) {
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortColumn = sortKey;
                currentSortDirection = 'asc';
            }

            // Update sort icon indicators in all headers
            document.querySelectorAll('#recipes-table th.sortable').forEach(header => {
                const iconSpan = header.querySelector('.sort-icon');
                if (header.dataset.sort === currentSortColumn) {
                    iconSpan.textContent = currentSortDirection === 'asc' ? '↑' : '↓';
                } else {
                    iconSpan.textContent = '↕';
                }
            });
            renderRecipesTable();
        });
    });

    const form = document.getElementById('recipe-form');
    form.addEventListener('submit', handleFormSubmit);
    document.getElementById('cancel-btn').addEventListener('click', () => { modal.style.display = 'none'; });
    const closeFormX = document.getElementById('recipe-modal-close-x-btn');
    if (closeFormX) closeFormX.addEventListener('click', () => { modal.style.display = 'none'; });
    document.getElementById('add-ingredient-row-btn').addEventListener('click', () => addIngredientRow());

    const detailsModal = document.getElementById('recipe-details-modal');
    if (detailsModal) {
        const closeBtn = document.getElementById('details-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => { detailsModal.style.display = 'none'; });
        }
    }

    // Recalcul temps réel unique via délégation d'événements
    form.addEventListener('input', (e) => {
        if (e.target.matches('#recipe-servings, #recipe-multiplier, #recipe-production-time, .ingredient-quantity')) {
            updateCostSummary();
        }
    });
    form.addEventListener('change', (e) => {
        if (e.target.matches('.ingredient-select, .ingredient-unit-select')) {
            updateCostSummary();
        }
    });

    // Check for query params or local storage flag to open modal
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'add' || localStorage.getItem('openRecipeModal') === 'true') {
        localStorage.removeItem('openRecipeModal');
        showRecipeModal();
    }

    const openDetailsId = localStorage.getItem('openRecipeDetailsId') || urlParams.get('details');
    if (openDetailsId) {
        localStorage.removeItem('openRecipeDetailsId');
        showRecipeDetails(parseInt(openDetailsId, 10));
    }

    const openEditId = localStorage.getItem('openRecipeEditId') || urlParams.get('edit');
    if (openEditId) {
        localStorage.removeItem('openRecipeEditId');
        showRecipeModal(parseInt(openEditId, 10));
    }
}

export function refreshRecettesPage() {
    renderRecipesTable();
}

function getAllergenNamesFromIds(allergenIds) {
    if (!Array.isArray(allergenIds) || allergenIds.length === 0) return [];
    const details = EU_ALLERGENS.filter(a => allergenIds.includes(a.id));
    return details.map(a => a.name);
}

function formatIngredientRowCostHTML(ingredient, quantity, recipeUnit, lineCost) {
    if (!ingredient || typeof ingredient.price !== 'number' || !Number.isFinite(ingredient.price)) {
        return '—';
    }
    const isSuspicious = (
        (String(ingredient.unit).toLowerCase().trim() === 'kg' && String(recipeUnit).toLowerCase().trim() === 'g' && quantity < 1) ||
        (String(ingredient.unit).toLowerCase().trim() === 'l' && ['ml', 'cl'].includes(String(recipeUnit).toLowerCase().trim()) && quantity < 1)
    );
    if (isSuspicious) {
        return `<span style="color: #d97706; font-weight: 700;" title="Attention : ${escapeHTML(quantity)} ${escapeHTML(recipeUnit)} est très faible (&lt; 1 g/ml). Vouliez-vous dire ${escapeHTML(quantity)} ${escapeHTML(ingredient.unit)} ?">! ${formatCurrency(lineCost)}</span>`;
    }
    return formatCurrency(lineCost);
}

// === RENDU DU TABLEAU PRINCIPAL ===
export function renderRecipesTable() {
    const tableBody = document.querySelector('#recipes-table tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const searchInput = document.getElementById('search-recipe');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filteredRecipes = recipes.filter(r => (r.name || '').toLowerCase().includes(searchTerm));

    if (filteredRecipes.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="10" class="table-empty">Aucune recette trouvée.</td></tr>`;
        return;
    }

    const targetPercent = TARGET_NET_MARGIN * 100;
    const mediumThreshold = targetPercent * 0.5;

    // Calculer les données de chaque recette pour le tri
    const computedRecipes = filteredRecipes.map(recipe => {
        const hasTime = !!(recipe.productionTime && recipe.productionTime > 0);
        const totalCost = calculateRecipeCost(recipe);
        const costPerServing = recipe.servings > 0 ? totalCost / recipe.servings : 0;
        const salePriceHT = costPerServing * (recipe.multiplier || 0);
        const salePriceTTC = salePriceHT * (1 + VAT_RATE);
        const grossMargin = salePriceHT > 0 ? ((salePriceHT - costPerServing) / salePriceHT) * 100 : null;
        const netMargin = hasTime ? calculateNetMargin(recipe) : null;
        const hourlyProfit = hasTime ? calculateHourlyProfitability(recipe) : null;
        const weightInfo = calculateRecipeWeight(recipe);
        const totalWeightKg = weightInfo.totalWeightKg;
        const salePricePerKgTTC = calculateSalePricePerKgTTC(recipe, totalWeightKg);

        return {
            recipe,
            name: recipe.name || '',
            servings: recipe.servings || null,
            multiplier: recipe.multiplier || null,
            totalCost,
            costPerServing,
            salePriceHT,
            salePriceTTC,
            totalWeightKg,
            salePricePerKgTTC,
            grossMargin,
            netMargin,
            hourlyProfit
        };
    });

    // Trier les recettes calculées (valeurs manquantes/null toujours placées en fin de liste)
    const isNumericCol = currentSortColumn !== 'name';
    computedRecipes.sort((a, b) => {
        const valA = a[currentSortColumn];
        const valB = b[currentSortColumn];

        const emptyA = valA === undefined || valA === null || valA === '' || (isNumericCol && !Number.isFinite(Number(valA)));
        const emptyB = valB === undefined || valB === null || valB === '' || (isNumericCol && !Number.isFinite(Number(valB)));

        if (emptyA && emptyB) return 0;
        if (emptyA) return 1;
        if (emptyB) return -1;

        if (!isNumericCol) {
            const cmp = String(valA).localeCompare(String(valB), 'fr', { sensitivity: 'base' });
            return currentSortDirection === 'asc' ? cmp : -cmp;
        }
        return currentSortDirection === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });

    computedRecipes.forEach(({ recipe, totalCost, costPerServing, salePriceHT, salePriceTTC, salePricePerKgTTC, grossMargin, netMargin, hourlyProfit }) => {
        // Marge brute classes & display
        let marginDisplay = 'N/A';
        let marginClass = '';
        if (grossMargin !== null) {
            marginDisplay = formatPercent(grossMargin);
            if (grossMargin >= 50) {
                marginClass = 'margin-high';
            } else if (grossMargin >= 30) {
                marginClass = 'margin-medium';
            } else {
                marginClass = 'margin-low';
            }
        }

        // Marge nette classes & display (seuils alignés sur la marge nette cible)
        let netMarginDisplay = 'N/A';
        let netMarginClass = '';
        if (netMargin !== null) {
            netMarginDisplay = formatPercent(netMargin);
            if (netMargin >= targetPercent) {
                netMarginClass = 'margin-high';
            } else if (netMargin >= mediumThreshold) {
                netMarginClass = 'margin-medium';
            } else {
                netMarginClass = 'margin-low';
            }
        }

        // Rentabilité horaire classes & display
        let hourlyProfitDisplay = 'N/A';
        let hourlyProfitClass = '';
        if (hourlyProfit !== null) {
            hourlyProfitDisplay = formatCurrency(hourlyProfit) + '/h';
            if (hourlyProfit >= 30) {
                hourlyProfitClass = 'profit-high';
            } else if (hourlyProfit >= 15) {
                hourlyProfitClass = 'profit-medium';
            } else {
                hourlyProfitClass = 'profit-low';
            }
        }

        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.innerHTML = `
            <td data-label="Recette">
                <div class="recipe-name-cell">
                    ${escapeHTML(recipe.name)}
                </div>
            </td>
            <td data-label="Portions" class="font-mono text-center">${recipe.servings || 'N/A'}</td>
            <td data-label="CM" class="font-mono text-center">${recipe.multiplier || 'N/A'}</td>
            <td data-label="Coût total" class="text-right font-mono">${formatCurrency3(totalCost)}</td>
            <td data-label="Coût / portion" class="text-right font-mono">${formatCurrency3(costPerServing)}</td>
            <td data-label="PV HT" class="text-right font-mono">${formatCurrency3(salePriceHT)}</td>
            <td data-label="PV TTC" class="text-right font-mono">
                <div>${formatCurrency3(salePriceTTC)}</div>
                ${salePricePerKgTTC !== null ? `<div style="font-size: 0.74rem; color: var(--text-light); font-weight: normal;" title="Prix de vente TTC au kilo = (PV TTC × Portions) ÷ Poids total">${formatCurrency(salePricePerKgTTC)}/kg</div>` : ''}
            </td>
            <td data-label="Marge brute" class="text-center"><span class="margin-badge ${marginClass}">${marginDisplay}</span></td>
            <td data-label="Marge nette" class="text-center"><span class="margin-badge ${netMarginClass}" title="Marge nette (après main d'œuvre et frais)">${netMarginDisplay}</span></td>
            <td data-label="€/heure" class="text-center"><span class="profitability-badge ${hourlyProfitClass}" title="Rentabilité horaire">${hourlyProfitDisplay}</span></td>
        `;
        row.addEventListener('click', () => showRecipeDetails(recipe.id));
        tableBody.appendChild(row);
    });
}

// === MODAL RECETTE ===
function showRecipeModal(recipeId = null) {
    const modal = document.getElementById('recipe-modal');
    const form = document.getElementById('recipe-form');
    form.reset();
    document.getElementById('ingredient-list').innerHTML = '';

    if (recipeId) {
        const recipe = recipes.find(r => r.id == recipeId);
        if (!recipe) return;
        document.getElementById('modal-title').textContent = 'Modifier la recette';
        document.getElementById('recipe-id').value = recipe.id;
        document.getElementById('recipe-name').value = recipe.name;
        document.getElementById('recipe-servings').value = recipe.servings;
        document.getElementById('recipe-multiplier').value = recipe.multiplier;
        document.getElementById('recipe-steps').value = recipe.steps || '';

        const productionTimeInput = document.getElementById('recipe-production-time');
        if (productionTimeInput) {
            productionTimeInput.value = recipe.productionTime || '';
        }

        if (Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0) {
            recipe.ingredients.forEach(ing => addIngredientRow(ing));
        } else {
            addIngredientRow();
        }
    } else {
        document.getElementById('modal-title').textContent = 'Ajouter une recette';
        document.getElementById('recipe-id').value = '';
        document.getElementById('recipe-steps').value = '';
        addIngredientRow();
    }

    updateCostSummary();
    modal.style.display = 'flex';
}

function addIngredientRow(ingredientItem = null) {
    const list = document.getElementById('ingredient-list');
    const row = document.createElement('div');
    row.className = 'ingredient-row';

    const currentEditingRecipeId = parseInt(document.getElementById('recipe-id')?.value, 10) || null;

    const select = document.createElement('select');
    select.className = 'ingredient-select';

    let optionsHtml = `<option value="">Choisir un composant...</option>`;

    // Option group 1: Mercuriale ingredients
    const ingredientsOptions = [...mercuriale]
        .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
        .map(ing => {
            const hasAllergens = ing.allergens && ing.allergens.length > 0;
            const allergenMarker = hasAllergens ? ' [Allergène]' : '';
            return `<option value="ing_${ing.id}" data-type="ingredient" data-id="${ing.id}">${escapeHTML(ing.name)} (${escapeHTML(ing.unit)})${allergenMarker}</option>`;
        }).join('');
    optionsHtml += `<optgroup label="Denrées (Mercuriale)">${ingredientsOptions}</optgroup>`;

    // Option group 2: Sub-recipes (exclude current recipe being edited to prevent self-nesting)
    const subRecipesOptions = [...recipes]
        .filter(r => !currentEditingRecipeId || r.id !== currentEditingRecipeId)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
        .map(r => `<option value="sub_${r.id}" data-type="subrecipe" data-id="${r.id}">[Sous-recette] ${escapeHTML(r.name)} (${r.servings || 1} portion${(r.servings || 1) > 1 ? 's' : ''})</option>`)
        .join('');

    if (subRecipesOptions) {
        optionsHtml += `<optgroup label="Sous-Recettes (Fiches techniques)">${subRecipesOptions}</optgroup>`;
    }

    select.innerHTML = optionsHtml;

    const quantityInput = document.createElement('input');
    quantityInput.type = 'number';
    quantityInput.className = 'ingredient-quantity';
    quantityInput.placeholder = 'Qté';
    quantityInput.step = '0.001';
    quantityInput.min = '0';

    const unitSelect = document.createElement('select');
    unitSelect.className = 'ingredient-unit-select';
    unitSelect.style.minWidth = '80px';

    const lineCostSpan = document.createElement('span');
    lineCostSpan.className = 'ingredient-row-cost font-mono';
    lineCostSpan.title = 'Coût ligne estimé';
    lineCostSpan.textContent = '—';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = '✕';
    deleteBtn.className = 'delete-ingredient-btn button-secondary';
    deleteBtn.title = 'Supprimer cet ingrédient';
    deleteBtn.setAttribute('aria-label', 'Supprimer cet ingrédient');
    deleteBtn.onclick = () => {
        row.remove();
        updateCostSummary();
    };

    function updateUnitOptions(preferredUnit = null) {
        const selectedOpt = select.options[select.selectedIndex];
        if (!selectedOpt || !selectedOpt.value) {
            unitSelect.innerHTML = `<option value="">-</option>`;
            unitSelect.dataset.prevUnit = '';
            return;
        }

        const type = selectedOpt.dataset.type;
        const id = parseInt(selectedOpt.dataset.id, 10);

        if (type === 'subrecipe') {
            unitSelect.innerHTML = `<option value="portion">portion(s)</option>`;
            unitSelect.value = 'portion';
            unitSelect.dataset.prevUnit = 'portion';
            quantityInput.placeholder = 'Portions';
        } else {
            const ing = getIngredientById(id);
            if (ing) {
                const compatUnits = getCompatibleUnits(ing.unit);
                unitSelect.innerHTML = compatUnits.map(u => `<option value="${escapeHTML(u)}">${escapeHTML(u)}</option>`).join('');
                quantityInput.placeholder = 'Qté';

                const targetUnit = preferredUnit || ing.unit || compatUnits[0];
                let matched = false;
                for (let i = 0; i < unitSelect.options.length; i++) {
                    if (unitSelect.options[i].value.toLowerCase() === String(targetUnit).toLowerCase()) {
                        unitSelect.selectedIndex = i;
                        matched = true;
                        break;
                    }
                }
                if (!matched && compatUnits.length > 0) {
                    unitSelect.value = compatUnits[0];
                }
                unitSelect.dataset.prevUnit = unitSelect.value;
            }
        }
    }

    // Les écouteurs locaux préparent les unités/conversions ; le formulaire appelle updateCostSummary() une seule fois.
    select.addEventListener('change', () => {
        updateUnitOptions();
    });

    unitSelect.addEventListener('change', () => {
        const prevUnit = unitSelect.dataset.prevUnit || '';
        const newUnit = unitSelect.value;
        if (prevUnit && newUnit && prevUnit !== newUnit && quantityInput.value) {
            const converted = convertQuantityBetweenUnits(quantityInput.value, prevUnit, newUnit);
            if (converted !== '' && !isNaN(converted)) {
                quantityInput.value = converted;
            }
        }
        unitSelect.dataset.prevUnit = newUnit;
    });

    if (ingredientItem) {
        if (ingredientItem.isSubRecipe || ingredientItem.type === 'subrecipe' || ingredientItem.subRecipeId) {
            const subId = ingredientItem.subRecipeId || ingredientItem.ingredientId;
            select.value = `sub_${subId}`;
            updateUnitOptions(ingredientItem.unit || 'portion');
            quantityInput.value = ingredientItem.quantity ?? '';
        } else if (ingredientItem.ingredientId) {
            select.value = `ing_${ingredientItem.ingredientId}`;
            const ing = getIngredientById(ingredientItem.ingredientId);
            const initialUnit = ingredientItem.unit || ing?.unit || '';
            updateUnitOptions(initialUnit);
            quantityInput.value = formatQuantityInput(ingredientItem.quantity, unitSelect.value || initialUnit);
        }
    }

    row.appendChild(select);
    row.appendChild(quantityInput);
    row.appendChild(unitSelect);
    row.appendChild(lineCostSpan);
    row.appendChild(deleteBtn);
    list.appendChild(row);
}

// === CALCUL ET AFFICHAGE DES COÛTS EN TEMPS RÉEL ===
function updateCostSummary() {
    const form = document.getElementById('recipe-form');
    const servings = parseFloat(form.querySelector('#recipe-servings').value) || 0;
    const multiplier = parseFloat(form.querySelector('#recipe-multiplier').value) || 0;
    const productionTime = parseFloat(form.querySelector('#recipe-production-time')?.value) || 0;
    const currentRecipeId = parseInt(form.querySelector('#recipe-id')?.value, 10) || null;

    let totalCost = 0;
    const allergenSet = new Set();
    const currentIngredients = [];

    form.querySelectorAll('.ingredient-row').forEach(row => {
        const select = row.querySelector('.ingredient-select');
        const selectedOpt = select.options[select.selectedIndex];
        const quantity = parseFloat(row.querySelector('.ingredient-quantity').value);
        const unit = row.querySelector('.ingredient-unit-select')?.value;
        const lineCostSpan = row.querySelector('.ingredient-row-cost');

        if (selectedOpt && selectedOpt.value && !isNaN(quantity) && quantity > 0) {
            const type = selectedOpt.dataset.type;
            const id = parseInt(selectedOpt.dataset.id, 10);

            if (type === 'subrecipe') {
                const subRecipe = recipes.find(r => parseInt(r.id, 10) === id);
                if (subRecipe) {
                    const visited = currentRecipeId ? new Set([currentRecipeId]) : new Set();
                    const subServings = Math.max(1, parseFloat(subRecipe.servings) || 1);
                    const subCostPerServing = calculateRecipeCost(subRecipe, visited) / subServings;
                    const lineCost = subCostPerServing * quantity;
                    totalCost += lineCost;

                    if (lineCostSpan) lineCostSpan.textContent = formatCurrency(lineCost);

                    currentIngredients.push({
                        isSubRecipe: true,
                        subRecipeId: id,
                        quantity,
                        unit: 'portion'
                    });

                    const subAllergens = getRecipeAllergens(subRecipe, visited);
                    subAllergens.forEach(a => allergenSet.add(a));
                } else if (lineCostSpan) {
                    lineCostSpan.textContent = '—';
                }
            } else {
                const ingredient = getIngredientById(id);
                if (ingredient) {
                    const recipeUnit = unit || ingredient.unit;
                    let lineCost = 0;
                    if (typeof ingredient.price === 'number' && Number.isFinite(ingredient.price)) {
                        const convertedQty = convertUnitQuantity(quantity, recipeUnit, ingredient.unit);
                        const yieldPct = (typeof ingredient.yield === 'number' && ingredient.yield > 0) ? ingredient.yield : 100;
                        const effectiveUnitPrice = ingredient.price / (yieldPct / 100);
                        lineCost = effectiveUnitPrice * convertedQty;
                        totalCost += lineCost;
                    }

                    if (lineCostSpan) {
                        lineCostSpan.innerHTML = formatIngredientRowCostHTML(ingredient, quantity, recipeUnit, lineCost);
                    }

                    currentIngredients.push({
                        ingredientId: id,
                        quantity,
                        unit: recipeUnit
                    });

                    if (Array.isArray(ingredient.allergens)) {
                        ingredient.allergens.forEach(a => allergenSet.add(a));
                    }
                } else if (lineCostSpan) {
                    lineCostSpan.textContent = '—';
                }
            }
        } else if (lineCostSpan) {
            lineCostSpan.textContent = '—';
        }
    });

    const costPerServing = servings > 0 ? totalCost / servings : 0;
    const salePriceHT = costPerServing * multiplier;
    const salePriceTTC = salePriceHT * (1 + VAT_RATE);

    const tempRecipe = {
        id: currentRecipeId,
        servings,
        multiplier,
        productionTime,
        ingredients: currentIngredients
    };

    // Calculs de rentabilité (Prime Cost)
    const laborCostPerServing = calculateLaborCostPerServing(tempRecipe);
    const totalCostPerServing = calculateTotalCostPerServing(tempRecipe);
    const netMargin = calculateNetMargin(tempRecipe);
    const hourlyProfitability = calculateHourlyProfitability(tempRecipe);
    const suggestedPrice = calculateSuggestedPrice(tempRecipe);

    // Calcul du poids et du prix de vente au kilo TTC
    const weightInfo = calculateRecipeWeight(tempRecipe);
    const totalWeightKg = weightInfo.totalWeightKg;
    const salePricePerKgTTC = calculateSalePricePerKgTTC(tempRecipe, totalWeightKg);

    // Mise à jour des affichages de base
    document.getElementById('total-cost-display').textContent = formatCurrency3(totalCost);
    document.getElementById('cost-per-serving-display').textContent = formatCurrency3(costPerServing);
    document.getElementById('sale-price-ht-display').textContent = formatCurrency3(salePriceHT);
    document.getElementById('sale-price-ttc-display').textContent = formatCurrency3(salePriceTTC);

    // Mise à jour du poids et du prix au kilo
    const weightEl = document.getElementById('recipe-total-weight-display');
    const salePriceKgEl = document.getElementById('sale-price-kg-display');
    const salePriceKgHeroBadge = document.getElementById('sale-price-kg-hero-badge');
    const salePriceKgHeroDisplay = document.getElementById('sale-price-kg-hero-display');

    if (weightEl) {
        weightEl.textContent = totalWeightKg > 0
            ? `${totalWeightKg.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}\u00A0kg`
            : '0,000\u00A0kg';
    }
    if (salePriceKgEl) {
        salePriceKgEl.textContent = salePricePerKgTTC !== null
            ? `${formatCurrency(salePricePerKgTTC)}\u00A0TTC/kg`
            : '—';
    }
    if (salePriceKgHeroBadge && salePriceKgHeroDisplay) {
        if (salePricePerKgTTC !== null && totalWeightKg > 0) {
            salePriceKgHeroDisplay.textContent = formatCurrency(salePricePerKgTTC);
            salePriceKgHeroBadge.style.display = 'inline-flex';
        } else {
            salePriceKgHeroBadge.style.display = 'none';
        }
    }

    // Mise à jour des affichages de rentabilité
    const laborCostEl = document.getElementById('labor-cost-display');
    const totalCostServingEl = document.getElementById('total-cost-serving-display');
    const netMarginEl = document.getElementById('net-margin-display');
    const hourlyProfitEl = document.getElementById('hourly-profit-display');
    const suggestedPriceTitleEl = document.getElementById('suggested-price-title');
    const suggestedPriceHTEl = document.getElementById('suggested-price-ht-display');
    const suggestedPriceTTCEl = document.getElementById('suggested-price-ttc-display');

    if (laborCostEl) laborCostEl.textContent = formatCurrency3(laborCostPerServing);
    if (totalCostServingEl) totalCostServingEl.textContent = formatCurrency3(totalCostPerServing);
    if (netMarginEl) {
        netMarginEl.textContent = productionTime > 0 ? formatPercent(netMargin) : 'N/A';
        netMarginEl.className = getMarginClass(netMargin, productionTime > 0);
    }
    if (hourlyProfitEl) {
        hourlyProfitEl.textContent = productionTime > 0 ? formatCurrency(hourlyProfitability) + '/h' : 'N/A';
        hourlyProfitEl.className = getProfitClass(hourlyProfitability, productionTime > 0);
    }
    if (suggestedPriceTitleEl) {
        suggestedPriceTitleEl.textContent = `Prix suggéré (Marge ${formatRate(TARGET_NET_MARGIN * 100)})`;
    }
    if (suggestedPriceHTEl) {
        suggestedPriceHTEl.textContent = productionTime > 0 && servings > 0 ? formatCurrency(suggestedPrice.ht) : 'N/A';
    }
    if (suggestedPriceTTCEl) {
        suggestedPriceTTCEl.textContent = productionTime > 0 && servings > 0 ? formatCurrency(suggestedPrice.ttc) : 'N/A';
    }

    // Affichage des allergènes dans le formulaire
    updateAllergenPreview(allergenSet);
}

function getMarginClass(margin, isValid) {
    if (!isValid) return '';
    const targetPercent = TARGET_NET_MARGIN * 100;
    if (margin >= targetPercent) return 'value-positive';
    if (margin >= targetPercent * 0.5) return 'value-warning';
    return 'value-negative';
}

function getProfitClass(profit, isValid) {
    if (!isValid) return '';
    if (profit >= 30) return 'value-positive';
    if (profit >= 15) return 'value-warning';
    return 'value-negative';
}

function updateAllergenPreview(allergenSet) {
    const previewEl = document.getElementById('allergen-preview');
    if (!previewEl) return;

    const allergenIds = [...allergenSet];
    const allergens = EU_ALLERGENS.filter(a => allergenIds.includes(a.id));

    if (allergens.length === 0) {
        previewEl.innerHTML = '<span class="no-allergen-preview">Aucun allergène détecté</span>';
    } else {
        previewEl.innerHTML = `
            <span class="allergen-warning">Allergènes détectés :</span>
            <div class="allergen-preview-list">
                ${allergens.map(a => `<span class="allergen-preview-item" title="${escapeHTML(a.description)}">${escapeHTML(a.name)}</span>`).join('')}
            </div>
        `;
    }
}

// === SAUVEGARDE ===
function handleFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const recipeId = form.querySelector('#recipe-id').value;
    const productionTimeInput = form.querySelector('#recipe-production-time');

    const servings = parseInt(form.querySelector('#recipe-servings').value, 10);
    const multiplier = parseFloat(form.querySelector('#recipe-multiplier').value);
    const productionTime = productionTimeInput ? (parseInt(productionTimeInput.value, 10) || 0) : 0;

    if (isNaN(servings) || servings <= 0) {
        showToast('Le nombre de portions doit être au moins 1.', 'error');
        return;
    }
    if (isNaN(multiplier) || multiplier <= 0) {
        showToast('Le coefficient multiplicateur doit être supérieur à 0.', 'error');
        return;
    }
    if (productionTime < 0) {
        showToast('Le temps de production ne peut pas être négatif.', 'error');
        return;
    }

    const recipeData = {
        id: recipeId ? parseInt(recipeId, 10) : nextRecipeId(),
        name: form.querySelector('#recipe-name').value.trim(),
        servings: servings,
        multiplier: multiplier,
        productionTime: productionTime,
        steps: form.querySelector('#recipe-steps').value || '',
        ingredients: []
    };

    form.querySelectorAll('.ingredient-row').forEach(row => {
        const select = row.querySelector('.ingredient-select');
        const selectedOpt = select.options[select.selectedIndex];
        const quantity = parseFloat(row.querySelector('.ingredient-quantity').value);
        const unit = row.querySelector('.ingredient-unit-select')?.value;

        if (selectedOpt && selectedOpt.value && !isNaN(quantity) && quantity > 0) {
            const type = selectedOpt.dataset.type;
            const id = parseInt(selectedOpt.dataset.id, 10);

            if (type === 'subrecipe') {
                recipeData.ingredients.push({
                    isSubRecipe: true,
                    subRecipeId: id,
                    quantity,
                    unit: 'portion'
                });
            } else {
                recipeData.ingredients.push({
                    ingredientId: id,
                    quantity,
                    unit: unit || getIngredientById(id)?.unit || ''
                });
            }
        }
    });

    if (recipeId) {
        const index = recipes.findIndex(r => r.id == recipeId);
        if (index !== -1) {
            recipes[index] = recipeData;
        } else {
            recipes.push(recipeData);
        }
    } else {
        recipes.push(recipeData);
    }

    saveData(recipes, mercuriale);
    renderRecipesTable();
    document.getElementById('recipe-modal').style.display = 'none';
    showToast(recipeId ? 'Recette modifiée avec succès.' : 'Recette ajoutée avec succès.', 'success');
}

function duplicateRecipe(recipeId) {
    const original = recipes.find(r => r.id == recipeId);
    if (!original) return;

    const cleanIngredients = (original.ingredients || []).map(item => {
        if (item.isSubRecipe || item.type === 'subrecipe' || item.subRecipeId) {
            return {
                isSubRecipe: true,
                subRecipeId: item.subRecipeId || item.ingredientId,
                quantity: parseFloat(item.quantity) || 1,
                unit: 'portion'
            };
        } else {
            const ing = getIngredientById(item.ingredientId);
            return {
                ingredientId: item.ingredientId,
                quantity: parseFloat(item.quantity) || 0,
                unit: item.unit || ing?.unit || 'g'
            };
        }
    });

    const copy = {
        id: nextRecipeId(),
        name: `${original.name} (copie)`,
        servings: Math.max(1, parseFloat(original.servings) || 1),
        multiplier: parseFloat(original.multiplier) || 3.5,
        productionTime: parseFloat(original.productionTime) || 0,
        steps: original.steps || '',
        ingredients: cleanIngredients
    };
    recipes.push(copy);
    saveData(recipes, mercuriale);
    renderRecipesTable();
    showRecipeModal(copy.id);
}

function deleteRecipe(recipeId) {
    const numericId = parseInt(recipeId, 10);
    const recipe = recipes.find(r => parseInt(r.id, 10) === numericId);
    const name = recipe ? escapeHTML(recipe.name) : 'cette recette';
    const parentRecipes = getRecipesUsingSubRecipe(numericId);

    let message = `Supprimer la recette <strong>${name}</strong> ?`;
    if (parentRecipes.length > 0) {
        const parentNames = parentRecipes.map(r => `<em>${escapeHTML(r.name)}</em>`).join(', ');
        message += `<br><br><strong>Attention :</strong> Cette recette est utilisée comme sous-recette dans ${parentRecipes.length} recette(s) : ${parentNames}.<br><br>En la supprimant, elle sera automatiquement retirée de ces recettes parentes.`;
    }

    showConfirm(message, () => {
        if (parentRecipes.length > 0) {
            recipes.forEach(r => {
                if (Array.isArray(r.ingredients)) {
                    r.ingredients = r.ingredients.filter(item =>
                        !(
                            (item.isSubRecipe || item.type === 'subrecipe' || item.subRecipeId) &&
                            parseInt(item.subRecipeId || item.ingredientId, 10) === numericId
                        )
                    );
                }
            });
        }
        const idx = recipes.findIndex(r => parseInt(r.id, 10) === numericId);
        if (idx !== -1) {
            recipes.splice(idx, 1);
            saveData(recipes, mercuriale);
        }
        renderRecipesTable();
        showToast(
            parentRecipes.length > 0 ? 'Recette supprimée et retirée des recettes parentes.' : 'Recette supprimée.',
            'warning'
        );
    }, {
        title: 'Supprimer une recette',
        confirmLabel: parentRecipes.length > 0 ? 'Nettoyer & Supprimer' : 'Supprimer',
        cancelLabel: 'Annuler',
        danger: true
    });
}

export function showRecipeDetails(recipeId) {
    const recipe = recipes.find(r => r.id == recipeId);
    if (!recipe) return;

    const modal = document.getElementById('recipe-details-modal');
    const content = document.getElementById('recipe-details-content');
    if (!modal || !content) return;

    const targetPercent = TARGET_NET_MARGIN * 100;
    const mediumThreshold = targetPercent * 0.5;
    const targetRateText = formatRate(targetPercent);

    const multiplier = Math.max(0, parseFloat(recipe.multiplier) || 0);
    const totalCost = calculateRecipeCost(recipe);
    const costPerServing = recipe.servings > 0 ? totalCost / recipe.servings : 0;
    const salePriceHT = costPerServing * multiplier;
    const salePriceTTC = salePriceHT * (1 + VAT_RATE);
    const grossMargin = salePriceHT > 0 ? ((salePriceHT - costPerServing) / salePriceHT) * 100 : 0;
    const netMargin = calculateNetMargin(recipe);
    const hourlyProfit = calculateHourlyProfitability(recipe);
    const suggestedPrice = calculateSuggestedPrice(recipe);
    const laborCostPerServing = calculateLaborCostPerServing(recipe);
    const totalCostPerServing = calculateTotalCostPerServing(recipe);

    // Allergènes
    const allergens = getRecipeAllergenDetails(recipe);
    const allergensPillsHtml = allergens.length > 0
        ? allergens.map(a => `
            <span class="allergen-pill" title="${escapeHTML(a.description)}">
                <span class="allergen-pill-name">${escapeHTML(a.name)}</span>
            </span>
          `).join('')
        : '<span class="allergen-pill allergen-pill-none">Aucun allergène détecté</span>';

    // Ingrédients & Sous-recettes table rows
    let ingredientsRowsHtml = '';
    if (!recipe.ingredients || recipe.ingredients.length === 0) {
        ingredientsRowsHtml = `<tr><td colspan="5" class="text-center text-muted" style="padding:2rem;">Aucun ingrédient dans cette recette.</td></tr>`;
    } else {
        recipe.ingredients.forEach(item => {
            const qty = parseFloat(item.quantity) || 0;
            if (item.isSubRecipe || item.type === 'subrecipe' || item.subRecipeId) {
                const subId = parseInt(item.subRecipeId || item.ingredientId, 10);
                const subRecipe = recipes.find(r => parseInt(r.id, 10) === subId);
                if (subRecipe) {
                    const visited = recipe.id ? new Set([parseInt(recipe.id, 10)]) : new Set();
                    const subServings = Math.max(1, parseFloat(subRecipe.servings) || 1);
                    const subCostPerServing = calculateRecipeCost(subRecipe, visited) / subServings;
                    const totalSubCost = subCostPerServing * qty;
                    const subAllergenIds = getRecipeAllergens(subRecipe, visited);
                    const subAllergens = EU_ALLERGENS.filter(a => subAllergenIds.includes(a.id));
                    const allergenNames = subAllergens.map(a => a.name).join(', ');
                    const allergenBadge = subAllergens.length > 0
                        ? `<span style="color:#ef4444;" title="${escapeHTML(allergenNames)}">${escapeHTML(allergenNames)}</span>`
                        : '<span style="color:#94a3b8;">—</span>';

                    ingredientsRowsHtml += `
                        <tr>
                            <td style="font-weight: 600;"><span class="subrecipe-badge">Sous-recette</span> ${escapeHTML(subRecipe.name)}</td>
                            <td class="text-center font-mono">${formatQuantityInput(qty, 'portion')} portion(s)</td>
                            <td class="text-right font-mono">${formatCurrency3(subCostPerServing)} / portion</td>
                            <td class="text-right font-mono" style="font-weight: 700;">${formatCurrency3(totalSubCost)}</td>
                            <td class="text-center font-mono">${allergenBadge}</td>
                        </tr>
                    `;
                }
            } else {
                const ing = getIngredientById(item.ingredientId);
                if (ing) {
                    const ingUnit = ing.unit;
                    const recipeUnit = item.unit || ingUnit;
                    const convertedQty = convertUnitQuantity(qty, recipeUnit, ingUnit);
                    const yieldPct = (typeof ing.yield === 'number' && ing.yield > 0) ? ing.yield : 100;
                    const effectiveUnitPrice = (typeof ing.price === 'number' && Number.isFinite(ing.price))
                        ? ing.price / (yieldPct / 100)
                        : 0;
                    const cost = effectiveUnitPrice * convertedQty;

                    const allergenNames = getAllergenNamesFromIds(ing.allergens);
                    const allergenText = allergenNames.join(', ');
                    const allergenBadge = allergenNames.length > 0
                        ? `<span style="color:#ef4444;" title="${escapeHTML(allergenText)}">${escapeHTML(allergenText)}</span>`
                        : '<span style="color:#94a3b8;">—</span>';

                    const isSuspiciousQty = (
                        (String(ingUnit).toLowerCase().trim() === 'kg' && String(recipeUnit).toLowerCase().trim() === 'g' && qty > 0 && qty < 1) ||
                        (String(ingUnit).toLowerCase().trim() === 'l' && ['ml', 'cl'].includes(String(recipeUnit).toLowerCase().trim()) && qty > 0 && qty < 1)
                    );
                    const qtyDisplay = isSuspiciousQty
                        ? `<span style="color:#b45309; font-weight:700; background:#fef3c7; padding:2px 6px; border-radius:4px;" title="Quantité anormalement basse (${escapeHTML(qty)} ${escapeHTML(recipeUnit)}) pour un ingrédient acheté au ${escapeHTML(ingUnit)}. Probable confusion avec ${escapeHTML(qty)} ${escapeHTML(ingUnit)}.">! ${formatQuantityInput(qty, recipeUnit)} ${escapeHTML(recipeUnit)}</span>`
                        : `${formatQuantityInput(qty, recipeUnit)} ${escapeHTML(recipeUnit)}`;

                    ingredientsRowsHtml += `
                        <tr>
                            <td style="font-weight: 600;">${escapeHTML(ing.name)}</td>
                            <td class="text-center font-mono">${qtyDisplay}</td>
                            <td class="text-right font-mono">${formatUnitPrice(effectiveUnitPrice)} / ${escapeHTML(ingUnit)}${yieldPct < 100 ? ` <small class="text-muted">(${yieldPct}%)</small>` : ''}</td>
                            <td class="text-right font-mono" style="font-weight: 700;">${formatCurrency3(cost)}</td>
                            <td class="text-center font-mono">${allergenBadge}</td>
                        </tr>
                    `;
                }
            }
        });
    }

    // === CALCUL DU POIDS TOTAL ET PRIX DE VENTE AU KG ===
    const weightInfo = calculateRecipeWeight(recipe);
    const totalWeightKg = weightInfo.totalWeightKg;
    const excludedCount = weightInfo.excludedCount;
    const volumeApproxUsed = weightInfo.volumeApproxUsed;
    const salePricePerKgTTC = calculateSalePricePerKgTTC(recipe, totalWeightKg);

    let weightFootnote = '';
    if (excludedCount > 0) {
        weightFootnote += `<small style="color:var(--text-light);">Poids partiel : ${excludedCount} ingrédient(s) sans poids exclu(s). Renseignez le "Poids brut / unité" dans la Mercuriale.</small><br>`;
    }
    if (volumeApproxUsed) {
        weightFootnote += `<small style="color:var(--text-light);">Liquides comptés avec densité ≈ 1 kg/L (approximation standard).</small>`;
    }

    const weightTotalRow = `
        <tr class="weight-total-row" style="background: var(--bg-secondary, #f8fafc); border-top: 2px solid var(--border-color, #e2e8f0); white-space: nowrap !important;">
            <td style="font-weight:700; padding-top:0.65rem; padding-bottom:0.65rem; white-space: nowrap !important;">Total recette</td>
            <td class="text-center font-mono" style="font-weight:700; padding-top:0.65rem; padding-bottom:0.65rem; white-space: nowrap !important;" title="Poids total calculé de la recette">
                ${totalWeightKg > 0 ? `${totalWeightKg.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}&nbsp;kg` : '—'}
            </td>
            <td class="text-right font-mono" style="color: var(--text-light); padding-top:0.65rem; padding-bottom:0.65rem; white-space: nowrap !important;">—</td>
            <td class="text-right font-mono" style="font-weight:700; padding-top:0.65rem; padding-bottom:0.65rem; white-space: nowrap !important;" title="Coût matière total pour le poids total de la recette">
                ${formatCurrency3(totalCost)}
            </td>
            <td style="padding-top:0.65rem; padding-bottom:0.65rem; white-space: nowrap !important;"></td>
        </tr>
        ${(excludedCount > 0 || volumeApproxUsed) ? `<tr><td colspan="5" style="padding-top:0.3rem; padding-bottom:0.6rem; line-height:1.4;">${weightFootnote}</td></tr>` : ''}
    `;

    ingredientsRowsHtml += weightTotalRow;

    // Diagnostics / Alerte rentabilité (seuils dynamiques basés sur TARGET_NET_MARGIN)
    let alertClass = 'alert-success';
    let alertTitle = 'Diagnostic rentabilité';
    let alertMessage = 'La recette est rentable et peut être vendue au prix appliqué sans risque de perte.';
    let statusClass = 'status-high';
    let statusText = `${targetRateText} cible atteinte`;
    let progressClass = 'fill-high';

    if (!recipe.productionTime || recipe.productionTime <= 0) {
        alertClass = '';
        alertTitle = 'Temps de production non renseigné';
        alertMessage = 'Renseignez le temps de production en modifiant la recette pour débloquer le diagnostic du Prime Cost SAS et la rentabilité horaire.';
        statusClass = 'status-medium';
        statusText = 'Temps de production non renseigné';
        progressClass = 'fill-medium';
    } else if (netMargin >= targetPercent) {
        alertClass = 'alert-success';
        alertTitle = 'Rentabilité conforme';
        alertMessage = `La recette couvre tous ses coûts et dégage ${formatCurrency(hourlyProfit)}/h de bénéfice net.`;
        statusClass = 'status-high';
        statusText = `${formatPercent(netMargin)} — Marge cible atteinte (${targetRateText})`;
        progressClass = 'fill-high';
    } else if (netMargin >= 0) {
        alertClass = '';
        alertTitle = 'Diagnostic rentabilité';
        alertMessage = `La recette est bénéficiaire mais sous la marge cible de ${targetRateText}. Prix suggéré : ${formatCurrency(suggestedPrice.ht)} HT (${formatCurrency(suggestedPrice.ttc)} TTC).`;
        statusClass = 'status-medium';
        statusText = `${formatPercent(netMargin)} — Sous l'objectif de ${targetRateText}`;
        progressClass = 'fill-medium';
    } else {
        alertClass = 'alert-danger';
        alertTitle = 'Attention rentabilité';
        alertMessage = `Cette recette est vendue à perte après déduction de la main d'œuvre et des frais. Prix suggéré : ${formatCurrency(suggestedPrice.ht)} HT.`;
        statusClass = 'status-low';
        statusText = `${formatPercent(netMargin)} — Recette déficitaire`;
        progressClass = 'fill-low';
    }

    const marginPercentValue = Math.min(100, Math.max(0, netMargin > 0 ? netMargin : 0));

    content.innerHTML = `
        <div class="recipe-modal-header">
            <div class="recipe-modal-title-area">
                <h2>${escapeHTML(recipe.name)}</h2>
                <div class="recipe-modal-subtitle">
                    <span class="recipe-meta-pill">${recipe.servings || 1} portion${(recipe.servings || 1) > 1 ? 's' : ''}</span>
                    <span class="recipe-meta-pill">${recipe.productionTime ? formatDuration(recipe.productionTime) : 'Temps N/A'}</span>
                    <span class="recipe-meta-pill">Coeff. Multiplicateur : ${multiplier}</span>
                </div>
            </div>
            <button type="button" class="modal-close-icon-btn" id="details-close-x-btn" title="Fermer (Échap)">✕</button>
        </div>

        <!-- 4 Top KPI Banner Cards -->
        <div class="recipe-kpis-banner">
            <div class="kpi-banner-card kpi-green">
                <span class="kpi-banner-label">Coût matière</span>
                <span class="kpi-banner-value">${formatCurrency3(costPerServing)}</span>
                <span class="kpi-banner-sub">Total : ${formatCurrency3(totalCost)}</span>
            </div>
            <div class="kpi-banner-card kpi-blue">
                <span class="kpi-banner-label">Coût complet</span>
                <span class="kpi-banner-value">${formatCurrency3(totalCostPerServing)} / p</span>
                <span class="kpi-banner-sub">MO &amp; Frais inclus</span>
            </div>
            <div class="kpi-banner-card ${netMargin >= targetPercent ? 'kpi-green' : (netMargin >= mediumThreshold ? 'kpi-amber' : 'kpi-red')}">
                <span class="kpi-banner-label">Marge nette</span>
                <span class="kpi-banner-value">${recipe.productionTime > 0 ? formatPercent(netMargin) : 'N/A'}</span>
                <span class="kpi-banner-sub">Marge cible : ${targetRateText}</span>
            </div>
            <div class="kpi-banner-card kpi-purple">
                <span class="kpi-banner-label">Prix conseillé</span>
                <span class="kpi-banner-value">${recipe.productionTime > 0 && recipe.servings > 0 ? formatCurrency(suggestedPrice.ht) + ' HT' : 'N/A'}</span>
                <span class="kpi-banner-sub">${recipe.productionTime > 0 && recipe.servings > 0 ? formatCurrency(suggestedPrice.ttc) + ' TTC' : `Calculé sur ${targetRateText} de marge`}</span>
            </div>
        </div>

        <!-- Main 2 Column Grid -->
        <div class="recipe-details-main-grid">
            <!-- Left Column: Details & Ingredients -->
            <div class="recipe-details-left-panel">
                <div class="recipe-panel-card">
                    <div class="recipe-panel-header">
                        <span>Détail de la recette</span>
                        <span style="font-size:0.85rem; font-weight:normal; color:var(--text-light);">${recipe.ingredients ? recipe.ingredients.length : 0} ingrédient(s)</span>
                    </div>
                    <div style="overflow-x:auto;">
                        <table class="ingredients-detail-table">
                            <thead>
                                <tr>
                                    <th>Ingrédient</th>
                                    <th class="text-center">Qté</th>
                                    <th class="text-right">P.U.</th>
                                    <th class="text-right">Sous-total</th>
                                    <th class="text-center">Allergènes</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ingredientsRowsHtml}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="recipe-panel-card">
                    <div class="recipe-panel-header">
                        <span>Allergènes détectés</span>
                    </div>
                    <div class="allergens-pills-container">
                        ${allergensPillsHtml}
                    </div>
                </div>

                ${recipe.steps ? `
                <div class="recipe-panel-card">
                    <div class="recipe-panel-header">
                        <span>Étapes de préparation</span>
                    </div>
                    <div style="font-size:0.92rem; line-height:1.6; color:var(--text-light); white-space:pre-wrap;">${escapeHTML(recipe.steps)}</div>
                </div>
                ` : ''}
            </div>

            <!-- Right Column: Rentabilité & Pricing -->
            <div class="recipe-details-right-panel">
                <div class="recipe-panel-card" style="display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                        <div class="recipe-panel-header">
                            <span>Rentabilité</span>
                        </div>

                        <div class="rentability-hero-price">
                            <div class="rentability-price-label">Prix de vente HT</div>
                            <div class="rentability-price-value-ht">${formatCurrency3(salePriceHT)}</div>
                            <div class="rentability-price-value-ttc">TTC (TVA ${formatRate(VAT_RATE * 100)}) : ${formatCurrency3(salePriceTTC)}</div>
                            ${salePricePerKgTTC !== null ? `
                                <div class="rentability-price-badge-kg" style="white-space: nowrap !important;" title="Prix de vente TTC au kilo = (${formatCurrency3(salePriceTTC)} TTC × ${recipe.servings || 1} portions) ÷ ${totalWeightKg.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg">
                                    Prix au kg : <strong>${formatCurrency(salePricePerKgTTC)}</strong> TTC/kg
                                </div>
                            ` : ''}
                        </div>

                        <div class="margin-progress-section">
                            <div class="rentability-price-label" style="display:flex; justify-content:space-between; margin-bottom:0.35rem;">
                                <span>Marge nette</span>
                                <span>${recipe.productionTime > 0 ? formatPercent(netMargin) : 'N/A'}</span>
                            </div>
                            <div class="margin-progress-bar-bg">
                                <div class="margin-progress-bar-fill ${progressClass}" style="width: ${marginPercentValue}%;"></div>
                            </div>
                            <div class="margin-target-status ${statusClass}" style="margin-top:0.4rem;">${statusText}</div>
                        </div>

                        <div class="friendly-alert-card ${alertClass}">
                            <div class="friendly-alert-title">${alertTitle}</div>
                            <div>${alertMessage}</div>
                        </div>

                        <div class="rentability-stats-list">
                            <div class="rentability-stat-item" style="background: rgba(79, 70, 229, 0.05); padding: 0.35rem 0.5rem; border-radius: 6px; margin-bottom: 0.35rem;">
                                <span class="rentability-stat-label" style="font-weight: 600; color: var(--text-color);">Prix de vente au kilo :</span>
                                <span class="rentability-stat-value font-mono" style="color: var(--primary-color); font-weight: 800;">
                                    ${salePricePerKgTTC !== null ? `${formatCurrency(salePricePerKgTTC)} TTC / kg` : '<span style="color:var(--text-light); font-weight:normal;">—</span>'}
                                </span>
                            </div>
                            <div class="rentability-stat-item">
                                <span class="rentability-stat-label">Coût Main d'Œuvre :</span>
                                <span class="rentability-stat-value">${formatCurrency3(laborCostPerServing)} / p</span>
                            </div>
                            <div class="rentability-stat-item">
                                <span class="rentability-stat-label">Rentabilité Horaire :</span>
                                <span class="rentability-stat-value" style="color:${hourlyProfit >= 30 ? 'var(--margin-high)' : (hourlyProfit >= 15 ? 'var(--margin-medium)' : 'var(--margin-low)')};">
                                    ${recipe.productionTime > 0 ? formatCurrency(hourlyProfit) + '/h' : 'N/A'}
                                </span>
                            </div>
                            <div class="rentability-stat-item">
                                <span class="rentability-stat-label">Marge Brute :</span>
                                <span class="rentability-stat-value">${formatPercent(grossMargin)}</span>
                            </div>
                        </div>
                    </div>

                    <div class="recipe-actions-row">
                        <button type="button" id="details-edit-btn" class="button-primary" title="Modifier la recette">Modifier</button>
                        <button type="button" id="details-duplicate-btn" class="button-secondary" title="Dupliquer la recette">Dupliquer</button>
                        <button type="button" id="details-print-btn" class="button-secondary" title="Générer et imprimer la feuille de calcul">Feuille de calcul (PDF)</button>
                        <button type="button" id="details-delete-btn" class="button-danger" title="Supprimer la recette">Supprimer</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Event listeners
    const closeX = document.getElementById('details-close-x-btn');
    if (closeX) closeX.onclick = () => { modal.style.display = 'none'; };

    const editBtn = document.getElementById('details-edit-btn');
    if (editBtn) editBtn.onclick = () => { modal.style.display = 'none'; showRecipeModal(recipeId); };

    const dupBtn = document.getElementById('details-duplicate-btn');
    if (dupBtn) dupBtn.onclick = () => { modal.style.display = 'none'; duplicateRecipe(recipeId); };

    const printBtn = document.getElementById('details-print-btn');
    if (printBtn) {
        printBtn.onclick = () => {
            const auditContainer = document.getElementById('calculation-audit-print-area');
            if (auditContainer) {
                auditContainer.innerHTML = generateCalculationAuditHTML(recipe);
                window.addEventListener('afterprint', () => {
                    auditContainer.innerHTML = '';
                }, { once: true });
            }
            window.print();
        };
    }

    const deleteBtn = document.getElementById('details-delete-btn');
    if (deleteBtn) deleteBtn.onclick = () => {
        modal.style.display = 'none';
        deleteRecipe(recipeId);
    };

    modal.style.display = 'flex';
}

// === GÉNÉRATION DE LA FEUILLE D'AUDIT DE CALCULS (IMPRESSION PDF, 0 EMOJI) ===
export function generateCalculationAuditHTML(recipe) {
    const servings = Math.max(1, parseFloat(recipe.servings) || 1);
    const multiplier = Math.max(0, parseFloat(recipe.multiplier) || 0);
    const prodTimeMinutes = Math.max(0, parseFloat(recipe.productionTime) || 0);
    const prodTimeHours = prodTimeMinutes / 60;
    const currentDateStr = new Date().toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // 1. Décomposition Matières Directes & Sous-recettes (toutes les lignes incluses)
    const ingredientRows = (recipe.ingredients || []).map((item, index) => {
        const qty = parseFloat(item.quantity) || 0;

        if (item.isSubRecipe || item.type === 'subrecipe' || item.subRecipeId) {
            const subId = parseInt(item.subRecipeId || item.ingredientId, 10);
            const subRecipe = recipes.find(r => parseInt(r.id, 10) === subId);
            if (!subRecipe) {
                return `
                    <tr>
                        <td style="text-align:center;">${index + 1}</td>
                        <td><strong>[Sous-recette] Introuvable (#${escapeHTML(subId)})</strong></td>
                        <td style="text-align:right;">${qty.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} portion(s)</td>
                        <td style="text-align:right;">—</td>
                        <td style="text-align:right; font-weight:600;">0,00 €</td>
                    </tr>
                `;
            }
            const visited = recipe.id ? new Set([parseInt(recipe.id, 10)]) : new Set();
            const subServings = Math.max(1, parseFloat(subRecipe.servings) || 1);
            const subCostPerServing = calculateRecipeCost(subRecipe, visited) / subServings;
            const lineCost = subCostPerServing * qty;
            return `
                <tr>
                    <td style="text-align:center;">${index + 1}</td>
                    <td><strong>[Sous-recette] ${escapeHTML(subRecipe.name)}</strong></td>
                    <td style="text-align:right;">${qty.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} portion(s)</td>
                    <td style="text-align:right;">${formatCurrency3(subCostPerServing)} / portion</td>
                    <td style="text-align:right; font-weight:600;">${formatCurrency3(lineCost)}</td>
                </tr>
            `;
        }

        const ing = getIngredientById(item.ingredientId);
        if (!ing) {
            return `
                <tr>
                    <td style="text-align:center;">${index + 1}</td>
                    <td><strong>Ingrédient inconnu (#${escapeHTML(item.ingredientId)})</strong></td>
                    <td style="text-align:right;">—</td>
                    <td style="text-align:right;">—</td>
                    <td style="text-align:right; font-weight:600;">0,00 €</td>
                </tr>
            `;
        }

        const ingUnit = ing.unit;
        const recipeUnit = item.unit || ingUnit;
        const convertedQty = convertUnitQuantity(qty, recipeUnit, ingUnit);
        const yieldPct = (typeof ing.yield === 'number' && ing.yield > 0) ? ing.yield : 100;
        const effectiveUnitPrice = (typeof ing.price === 'number' && Number.isFinite(ing.price))
            ? ing.price / (yieldPct / 100)
            : 0;
        const lineCost = effectiveUnitPrice * convertedQty;
        const yieldNote = yieldPct < 100 ? ` <small style="color:#666666;">(rend. ${yieldPct}%)</small>` : '';

        return `
            <tr>
                <td style="text-align:center;">${index + 1}</td>
                <td><strong>${escapeHTML(ing.name)}</strong></td>
                <td style="text-align:right;">${qty.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ${escapeHTML(recipeUnit)}</td>
                <td style="text-align:right;">${formatUnitPrice(effectiveUnitPrice)} / ${escapeHTML(ingUnit)}${yieldNote}</td>
                <td style="text-align:right; font-weight:600;">${formatCurrency3(lineCost)}</td>
            </tr>
        `;
    }).join('');

    // Référence authoritative via calculateRecipeCost (inclut sous-recettes + yield + conversion)
    const verifiedFoodCost = calculateRecipeCost(recipe);
    const foodCostPerServing = verifiedFoodCost / servings;

    // 2. Main d'Œuvre (Labor Cost)
    const totalLaborCost = prodTimeHours * CHARGED_HOURLY_RATE;
    const laborCostPerServing = totalLaborCost / servings;
    const laborTimePerServingMin = prodTimeMinutes / servings;

    // 3. Prime Cost & Overhead & Full Cost
    const primeCostPerServing = foodCostPerServing + laborCostPerServing;
    const overheadPerServing = primeCostPerServing * OVERHEAD_RATE;
    const fullCostPerServing = primeCostPerServing + overheadPerServing;
    const totalFullCost = fullCostPerServing * servings;

    // 4. Tarification & Prix Fixé
    const salePriceHT = foodCostPerServing * multiplier;
    const salePriceTTC = salePriceHT * (1 + VAT_RATE);

    // 5. Analyse Financière & Marge Nette Réelle
    const netProfitPerServing = salePriceHT - fullCostPerServing;
    const totalNetProfit = netProfitPerServing * servings;
    const netMarginPercent = salePriceHT > 0 ? (netProfitPerServing / salePriceHT) * 100 : 0;
    const grossMarginPercent = salePriceHT > 0 ? ((salePriceHT - foodCostPerServing) / salePriceHT) * 100 : 0;
    const hourlyProfitability = prodTimeHours > 0 ? totalNetProfit / prodTimeHours : 0;

    // 6. Tarification Cible (protégée contre division par zéro via calculateSuggestedPrice)
    const suggested = calculateSuggestedPrice(recipe);
    const suggestedPriceHT = suggested.ht;
    const suggestedPriceTTC = suggested.ttc;

    // 7. Poids & Prix au Kilo TTC
    const weightInfo = calculateRecipeWeight(recipe);
    const totalWeightKg = weightInfo.totalWeightKg;
    const salePricePerKgTTC = calculateSalePricePerKgTTC(recipe, totalWeightKg);

    const overheadRateStr = formatRate(OVERHEAD_RATE * 100);
    const vatRateStr = formatRate(VAT_RATE * 100);
    const targetMarginStr = formatRate(TARGET_NET_MARGIN * 100);
    const vatFactorStr = formatDecimalFactor(1 + VAT_RATE);
    const overheadFactorStr = formatDecimalFactor(OVERHEAD_RATE);
    const targetMarginFactorStr = formatDecimalFactor(TARGET_NET_MARGIN);
    const oneMinusTargetStr = formatDecimalFactor(1 - TARGET_NET_MARGIN);

    return `
        <div class="audit-sheet">
            <div class="audit-header">
                <div class="audit-title-block">
                    <h1>FEUILLE DE CALCUL &amp; AUDIT DE RENTABILITÉ MÉTIER</h1>
                    <div class="audit-subtitle">Fiche technique &amp; Rapport mathématique exhaustif</div>
                </div>
                <div class="audit-meta-block">
                    <div><strong>Date :</strong> ${currentDateStr}</div>
                    <div><strong>Recette :</strong> ${escapeHTML(recipe.name)}</div>
                </div>
            </div>

            <!-- Paramètres de Configuration Globaux -->
            <div class="audit-section">
                <h2>1. PARAMÈTRES ET HYPOTHÈSES DE CALCUL</h2>
                <div class="audit-grid-4" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));">
                    <div class="audit-card">
                        <span class="card-label">Portions (N)</span>
                        <span class="card-value">${servings}</span>
                    </div>
                    <div class="audit-card">
                        <span class="card-label">Poids Total</span>
                        <span class="card-value">${totalWeightKg > 0 ? `${totalWeightKg.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg` : 'N/A'}</span>
                    </div>
                    <div class="audit-card">
                        <span class="card-label">Temps Prod. Total (T)</span>
                        <span class="card-value">${prodTimeMinutes} min (${prodTimeHours.toFixed(2)} h)</span>
                    </div>
                    <div class="audit-card">
                        <span class="card-label">Coeff. Multiplicateur (CM)</span>
                        <span class="card-value">${multiplier}</span>
                    </div>
                    <div class="audit-card">
                        <span class="card-label">Taux Horaire MO (TH)</span>
                        <span class="card-value">${formatCurrency(CHARGED_HOURLY_RATE)}/h</span>
                    </div>
                </div>
                <div class="audit-params-list">
                    <span>Frais Généraux : <strong>${overheadRateStr}</strong> du Prime Cost</span> |
                    <span>Taux de TVA : <strong>${vatRateStr}</strong></span> |
                    <span>Marge Nette Cible : <strong>${targetMarginStr}</strong></span>
                </div>
            </div>

            <!-- 2. Décomposition Matières Premières -->
            <div class="audit-section">
                <h2>2. DÉCOMPOSITION DES COÛTS MATIÈRES DIRECTS (FOOD COST)</h2>
                <table class="audit-table">
                    <thead>
                        <tr>
                            <th class="col-num">#</th>
                            <th class="col-name">Ingrédient / Sous-recette</th>
                            <th class="col-qty">Quantité nette</th>
                            <th class="col-pu">Prix Unitaire HT (après rendement)</th>
                            <th class="col-total">Coût Ligne HT</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ingredientRows || '<tr><td colspan="5" style="text-align:center;">Aucun ingrédient renseigné</td></tr>'}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="4" style="text-align:right; font-weight:bold;">Coût Matière Total (CMT) :</td>
                            <td style="text-align:right; font-weight:bold;">${formatCurrency3(verifiedFoodCost)}</td>
                        </tr>
                        <tr class="highlight-row">
                            <td colspan="4" style="text-align:right; font-weight:bold;">Coût Matière / Portion (CMP = CMT / N) :</td>
                            <td style="text-align:right; font-weight:bold;">${formatCurrency3(foodCostPerServing)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <!-- 3. Formules Main d'Oeuvre & Prime Cost -->
            <div class="audit-section">
                <h2>3. COÛT MAIN D'ŒUVRE &amp; PRIME COST</h2>
                <div class="audit-formula-grid">
                    <div class="audit-formula-row">
                        <span class="formula-label">Temps MO par portion</span>
                        <span class="formula-expr">T_min / N = ${prodTimeMinutes} / ${servings}</span>
                        <span class="formula-val">${laborTimePerServingMin.toFixed(2)} min</span>
                    </div>
                    <div class="audit-formula-row">
                        <span class="formula-label">Coût MO par portion</span>
                        <span class="formula-expr">(${laborTimePerServingMin.toFixed(2)} min / 60) × ${formatCurrency(CHARGED_HOURLY_RATE)}</span>
                        <span class="formula-val">${formatCurrency3(laborCostPerServing)}</span>
                    </div>
                    <div class="audit-formula-row bold-row">
                        <span class="formula-label">Prime Cost par portion</span>
                        <span class="formula-expr">CMP + CMO_portion = ${formatCurrency3(foodCostPerServing)} + ${formatCurrency3(laborCostPerServing)}</span>
                        <span class="formula-val">${formatCurrency3(primeCostPerServing)}</span>
                    </div>
                </div>
            </div>

            <!-- 4. Coût Complet (Full Cost) -->
            <div class="audit-section">
                <h2>4. FRAIS GÉNÉRAUX &amp; COÛT COMPLET (FULL COST)</h2>
                <div class="audit-formula-grid">
                    <div class="audit-formula-row">
                        <span class="formula-label">Frais Généraux / portion (${overheadRateStr})</span>
                        <span class="formula-expr">PC_portion × ${overheadRateStr} = ${formatCurrency3(primeCostPerServing)} × ${overheadFactorStr}</span>
                        <span class="formula-val">${formatCurrency3(overheadPerServing)}</span>
                    </div>
                    <div class="audit-formula-row bold-row">
                        <span class="formula-label">Coût Complet par portion</span>
                        <span class="formula-expr">PC_portion + FG_portion</span>
                        <span class="formula-val">${formatCurrency3(fullCostPerServing)}</span>
                    </div>
                    <div class="audit-formula-row">
                        <span class="formula-label">Coût Complet Total Recette</span>
                        <span class="formula-expr">CC_portion × N = ${formatCurrency3(fullCostPerServing)} × ${servings}</span>
                        <span class="formula-val">${formatCurrency3(totalFullCost)}</span>
                    </div>
                </div>
            </div>

            <!-- 5. Tarification Fixée & Analyse Financière -->
            <div class="audit-section">
                <h2>5. TARIFICATION APPLIQUÉE &amp; MARGE NETTE RÉELLE</h2>
                <div class="audit-formula-grid">
                    <div class="audit-formula-row">
                        <span class="formula-label">Prix de Vente HT (CM = ${multiplier})</span>
                        <span class="formula-expr">CMP × CM = ${formatCurrency3(foodCostPerServing)} × ${multiplier}</span>
                        <span class="formula-val">${formatCurrency3(salePriceHT)} HT</span>
                    </div>
                    <div class="audit-formula-row">
                        <span class="formula-label">Prix de Vente TTC (TVA ${vatRateStr})</span>
                        <span class="formula-expr">PV_HT × ${vatFactorStr}</span>
                        <span class="formula-val">${formatCurrency3(salePriceTTC)} TTC</span>
                    </div>
                    <div class="audit-formula-row highlight-row">
                        <span class="formula-label">Prix de Vente au Kilo TTC</span>
                        <span class="formula-expr">(PV_TTC × N) / Poids = (${formatCurrency3(salePriceTTC)} × ${servings}) / ${totalWeightKg > 0 ? `${totalWeightKg.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg` : 'N/A'}</span>
                        <span class="formula-val">${salePricePerKgTTC !== null ? `${formatCurrency(salePricePerKgTTC)} TTC / kg` : 'N/A'}</span>
                    </div>
                    <div class="audit-formula-row">
                        <span class="formula-label">Bénéfice Net / portion</span>
                        <span class="formula-expr">PV_HT - CC_portion = ${formatCurrency3(salePriceHT)} - ${formatCurrency3(fullCostPerServing)}</span>
                        <span class="formula-val">${formatCurrency3(netProfitPerServing)}</span>
                    </div>
                    <div class="audit-formula-row">
                        <span class="formula-label">Marge Brute (%)</span>
                        <span class="formula-expr">((PV_HT - CMP) / PV_HT) × 100</span>
                        <span class="formula-val">${grossMarginPercent.toFixed(1)} %</span>
                    </div>
                    <div class="audit-formula-row">
                        <span class="formula-label">Marge Nette Réelle (%)</span>
                        <span class="formula-expr">(B_net / PV_HT) × 100</span>
                        <span class="formula-val">${netMarginPercent.toFixed(1)} %</span>
                    </div>
                    <div class="audit-formula-row highlight-row">
                        <span class="formula-label">Rentabilité Horaire Gérant</span>
                        <span class="formula-expr">B_net_total / T_heures = ${formatCurrency3(totalNetProfit)} / ${prodTimeHours.toFixed(2)}h</span>
                        <span class="formula-val">${formatCurrency(hourlyProfitability)}/h</span>
                    </div>
                </div>
            </div>

            <!-- 6. Tarification Cible Suggérée -->
            <div class="audit-section">
                <h2>6. PRIX DE VENTE SUGGÉRÉ POUR MARGE NETTE CIBLE (${targetMarginStr})</h2>
                <div class="audit-formula-grid highlight">
                    <div class="audit-formula-row">
                        <span class="formula-label">Prix HT Suggéré (MN ${targetMarginStr})</span>
                        <span class="formula-expr">CC_portion / (1 - ${targetMarginFactorStr}) = ${formatCurrency3(fullCostPerServing)} / ${oneMinusTargetStr}</span>
                        <span class="formula-val">${formatCurrency3(suggestedPriceHT)} HT</span>
                    </div>
                    <div class="audit-formula-row">
                        <span class="formula-label">Prix TTC Suggéré (TVA ${vatRateStr})</span>
                        <span class="formula-expr">PV_HT_suggéré × ${vatFactorStr}</span>
                        <span class="formula-val">${formatCurrency3(suggestedPriceTTC)} TTC</span>
                    </div>
                </div>
            </div>

            <div class="audit-footer">
                Feuille de Calcul &amp; Audit Financier générée par l'Application de Gestion Culinaire • Modèle Prime Cost SAS • Taux horaire chargé : ${formatCurrency(CHARGED_HOURLY_RATE)}/h.
            </div>
        </div>
    `;
}
