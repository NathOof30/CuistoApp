import {
    mercuriale, recipes, VAT_RATE,
    getIngredientById, calculateRecipeCost, saveData,
    EU_ALLERGENS,
    calculateLaborCostPerServing, calculateTotalCostPerServing,
    calculateActualPriceHTPerServing,
    calculateNetMargin, calculateHourlyProfitability, calculateSuggestedPrice,
    getRecipeAllergens, getRecipeAllergenDetails, nextRecipeId
} from '../data.js';
import { formatCurrency, formatCurrency3, formatPercent, formatDuration, escapeHTML, formatQuantityInput } from './common.js';
import { showToast, showConfirm } from './ui-feedback.js';

// Utiliser directement les exports pour éviter l'état obsolète
let currentSortColumn = 'name';
let currentSortDirection = 'asc';

export function initRecettesPage() {
    const tableBody = document.querySelector('#recipes-table tbody');
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

    // Fermeture par Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const recipeModal = document.getElementById('recipe-modal');
            const allergenModal = document.getElementById('allergen-modal');
            const detailsModal = document.getElementById('recipe-details-modal');
            if (recipeModal && recipeModal.style.display !== 'none') recipeModal.style.display = 'none';
            if (allergenModal && allergenModal.style.display !== 'none') allergenModal.style.display = 'none';
            if (detailsModal && detailsModal.style.display !== 'none') detailsModal.style.display = 'none';
        }
    });

    // Fermeture en cliquant sur l'overlay
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

    const detailsModal = document.getElementById('recipe-details-modal');
    if (detailsModal) {
        detailsModal.addEventListener('click', (e) => { if (e.target === detailsModal) detailsModal.style.display = 'none'; });
        const closeBtn = document.getElementById('details-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => { detailsModal.style.display = 'none'; });
        }
    }

    // Listen for input changes within the form to update costs in real-time
    form.addEventListener('input', (e) => {
        if (e.target.matches('#recipe-servings, #recipe-multiplier, #recipe-production-time, .ingredient-quantity, .ingredient-select')) {
            updateCostSummary();
        }
    });

    // Check for query params or local storage flag to open modal
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'add' || localStorage.getItem('openRecipeModal') === 'true') {
        localStorage.removeItem('openRecipeModal');
        showRecipeModal();
    }

    // Setup allergen modal close
    setupAllergenModal();
}

// === RENDU DU TABLEAU PRINCIPAL ===
export function renderRecipesTable() {
    const tableBody = document.querySelector('#recipes-table tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const searchInput = document.getElementById('search-recipe');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filteredRecipes = recipes.filter(r => r.name.toLowerCase().includes(searchTerm));

    if (filteredRecipes.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="11" class="table-empty">Aucune recette trouvée.</td></tr>`;
        return;
    }

    // Calculer les données de chaque recette pour le tri
    const computedRecipes = filteredRecipes.map(recipe => {
        const totalCost = calculateRecipeCost(recipe);
        const costPerServing = recipe.servings > 0 ? totalCost / recipe.servings : 0;
        const salePriceHT = costPerServing * (recipe.multiplier || 0);
        const salePriceTTC = salePriceHT * (1 + VAT_RATE);
        const grossMargin = salePriceHT > 0 ? ((salePriceHT - costPerServing) / salePriceHT) * 100 : 0;
        const netMargin = calculateNetMargin(recipe);
        const hourlyProfit = calculateHourlyProfitability(recipe);

        return {
            recipe,
            name: recipe.name || '',
            servings: recipe.servings || 0,
            multiplier: recipe.multiplier || 0,
            totalCost,
            costPerServing,
            salePriceHT,
            salePriceTTC,
            grossMargin,
            netMargin,
            hourlyProfit
        };
    });

    // Trier les recettes calculées
    computedRecipes.sort((a, b) => {
        let valA = a[currentSortColumn];
        let valB = b[currentSortColumn];

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (typeof valA === 'string') {
            const cmp = valA.localeCompare(valB, 'fr', { sensitivity: 'base' });
            return currentSortDirection === 'asc' ? cmp : -cmp;
        } else {
            return currentSortDirection === 'asc' ? valA - valB : valB - valA;
        }
    });

    computedRecipes.forEach(({ recipe, totalCost, costPerServing, salePriceHT, salePriceTTC, grossMargin, netMargin, hourlyProfit }) => {
        // Marge brute classes & display
        let marginDisplay = 'N/A';
        let marginClass = '';
        if (salePriceHT > 0) {
            marginDisplay = formatPercent(grossMargin);
            if (grossMargin >= 50) {
                marginClass = 'margin-high';
            } else if (grossMargin >= 30) {
                marginClass = 'margin-medium';
            } else {
                marginClass = 'margin-low';
            }
        }

        // Marge nette classes & display
        let netMarginDisplay = 'N/A';
        let netMarginClass = '';
        if (recipe.productionTime && recipe.productionTime > 0) {
            netMarginDisplay = formatPercent(netMargin);
            if (netMargin >= 20) {
                netMarginClass = 'margin-high';
            } else if (netMargin >= 10) {
                netMarginClass = 'margin-medium';
            } else {
                netMarginClass = 'margin-low';
            }
        }

        // Rentabilité horaire classes & display
        let hourlyProfitDisplay = 'N/A';
        let hourlyProfitClass = '';
        if (recipe.productionTime && recipe.productionTime > 0) {
            hourlyProfitDisplay = formatCurrency(hourlyProfit) + '/h';
            if (hourlyProfit >= 30) {
                hourlyProfitClass = 'profit-high';
            } else if (hourlyProfit >= 15) {
                hourlyProfitClass = 'profit-medium';
            } else {
                hourlyProfitClass = 'profit-low';
            }
        }

        // Allergènes
        const allergens = getRecipeAllergenDetails(recipe);
        const allergensHtml = renderAllergenBadges(allergens, recipe.id);

        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.innerHTML = `
            <td data-label="Recette">
                <div class="recipe-name-cell">
                    ${escapeHTML(recipe.name)}
                    ${allergensHtml}
                </div>
            </td>
            <td data-label="Portions" class="font-mono text-center">${recipe.servings || 'N/A'}</td>
            <td data-label="CM" class="font-mono text-center">${recipe.multiplier || 'N/A'}</td>
            <td data-label="Coût total" class="text-right font-mono">${formatCurrency3(totalCost)}</td>
            <td data-label="Coût / portion" class="text-right font-mono">${formatCurrency3(costPerServing)}</td>
            <td data-label="PV HT" class="text-right font-mono">${formatCurrency3(salePriceHT)}</td>
            <td data-label="PV TTC" class="text-right font-mono">${formatCurrency3(salePriceTTC)}</td>
            <td data-label="Marge brute" class="text-center"><span class="margin-badge ${marginClass}">${marginDisplay}</span></td>
            <td data-label="Marge nette" class="text-center"><span class="margin-badge ${netMarginClass}" title="Marge nette (après main d'œuvre et frais)">${netMarginDisplay}</span></td>
            <td data-label="€/heure" class="text-center"><span class="profitability-badge ${hourlyProfitClass}" title="Rentabilité horaire">${hourlyProfitDisplay}</span></td>
        `;
        row.addEventListener('click', () => showRecipeDetails(recipe.id));
        tableBody.appendChild(row);
    });

    // Event listeners pour les badges d'allergènes
    tableBody.querySelectorAll('.allergen-indicator').forEach(badge => {
        badge.addEventListener('click', (e) => {
            e.stopPropagation();
            const recipeId = badge.dataset.recipeId;
            showAllergenModal(recipeId);
        });
    });
}

// === AFFICHAGE DES ALLERGÈNES ===
function renderAllergenBadges(allergens, recipeId) {
    if (!allergens || allergens.length === 0) {
        return '<span class="no-allergen-badge" title="Aucun allergène identifié">✓</span>';
    }

    return `<button type="button" class="allergen-indicator" data-recipe-id="${recipeId}" title="Contient ${allergens.length} allergène(s) - Cliquer pour détails">
        ⚠️
    </button>`;
}

function setupAllergenModal() {
    const modal = document.getElementById('allergen-modal');
    if (!modal) return;

    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.classList.contains('modal-close-btn')) {
            modal.style.display = 'none';
        }
    });
}

function showAllergenModal(recipeId) {
    const modal = document.getElementById('allergen-modal');
    if (!modal) return;

    const recipe = recipes.find(r => r.id == recipeId);
    if (!recipe) return;

    const allergens = getRecipeAllergenDetails(recipe);
    const titleEl = modal.querySelector('.allergen-modal-title');
    const listEl = modal.querySelector('.allergen-list');

    titleEl.textContent = `Allergènes - ${recipe.name}`;

    if (allergens.length === 0) {
        listEl.innerHTML = '<p class="no-allergens-message">Aucun allergène identifié dans cette recette.</p>';
    } else {
        listEl.innerHTML = allergens.map(a => `
            <div class="allergen-item">
                <span class="allergen-icon">${a.icon}</span>
                <div class="allergen-info">
                    <strong>${a.name}</strong>
                    <p>${a.description}</p>
                </div>
            </div>
        `).join('');
    }

    modal.style.display = 'flex';
}

// === MODAL RECETTE ===
function showRecipeModal(recipeId = null) {
    const modal = document.getElementById('recipe-modal');
    const form = document.getElementById('recipe-form');
    form.reset();
    document.getElementById('ingredient-list').innerHTML = '';

    if (recipeId) {
        const recipe = recipes.find(r => r.id == recipeId);
        document.getElementById('modal-title').textContent = 'Modifier la recette';
        document.getElementById('recipe-id').value = recipe.id;
        document.getElementById('recipe-name').value = recipe.name;
        document.getElementById('recipe-servings').value = recipe.servings;
        document.getElementById('recipe-multiplier').value = recipe.multiplier;
        document.getElementById('recipe-steps').value = recipe.steps || '';

        // Temps de production
        const productionTimeInput = document.getElementById('recipe-production-time');
        if (productionTimeInput) {
            productionTimeInput.value = recipe.productionTime || '';
        }

        recipe.ingredients.forEach(ing => addIngredientRow(ing));
    } else {
        document.getElementById('modal-title').textContent = 'Ajouter une recette';
        document.getElementById('recipe-id').value = '';
        document.getElementById('recipe-steps').value = '';
        addIngredientRow(); // Add one empty row to start
    }

    updateCostSummary();
    modal.style.display = 'flex';
}

function addIngredientRow(ingredientItem = null) {
    const list = document.getElementById('ingredient-list');
    const row = document.createElement('div');
    row.className = 'ingredient-row';

    const select = document.createElement('select');
    select.className = 'ingredient-select';
    select.innerHTML = `<option value="">Choisir un ingrédient...</option>` +
        [...mercuriale].sort((a, b) => a.name.localeCompare(b.name)).map(ing => {
            const hasAllergens = ing.allergens && ing.allergens.length > 0;
            const allergenIcon = hasAllergens ? ' ⚠️' : '';
            return `<option value="${ing.id}">${escapeHTML(ing.name)} (${escapeHTML(ing.unit)})${allergenIcon}</option>`;
        }).join('');

    const quantityInput = document.createElement('input');
    quantityInput.type = 'number';
    quantityInput.className = 'ingredient-quantity';
    quantityInput.placeholder = 'Qté';
    quantityInput.step = '0.001';
    quantityInput.min = '0';

    const unitLabel = document.createElement('span');
    unitLabel.className = 'ingredient-unit';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = '🗑️';
    deleteBtn.className = 'delete-ingredient-btn button-secondary';
    deleteBtn.onclick = () => {
        row.remove();
        updateCostSummary();
    };

    if (ingredientItem) {
        select.value = ingredientItem.ingredientId;
        // Afficher les quantités avec 3 décimales
        const unit = getIngredientById(ingredientItem.ingredientId)?.unit || '';
        quantityInput.value = formatQuantityInput(ingredientItem.quantity, unit);
        const selectedIng = getIngredientById(ingredientItem.ingredientId);
        if (selectedIng) unitLabel.textContent = selectedIng.unit;
    }

    select.addEventListener('change', () => {
        const selectedIng = getIngredientById(parseInt(select.value));
        unitLabel.textContent = selectedIng ? selectedIng.unit : '';
        updateCostSummary();
    });

    row.appendChild(select);
    row.appendChild(quantityInput);
    row.appendChild(unitLabel);
    row.appendChild(deleteBtn);
    list.appendChild(row);
}

// === CALCUL ET AFFICHAGE DES COÛTS EN TEMPS RÉEL ===
function updateCostSummary() {
    const form = document.getElementById('recipe-form');
    const servings = parseFloat(form.querySelector('#recipe-servings').value) || 0;
    const multiplier = parseFloat(form.querySelector('#recipe-multiplier').value) || 0;
    const productionTime = parseFloat(form.querySelector('#recipe-production-time')?.value) || 0;

    let totalCost = 0;
    const allergenSet = new Set();

    form.querySelectorAll('.ingredient-row').forEach(row => {
        const ingId = parseInt(row.querySelector('.ingredient-select').value);
        const quantity = parseFloat(row.querySelector('.ingredient-quantity').value);
        if (ingId && quantity > 0) {
            const ingredient = getIngredientById(ingId);
            if (ingredient) {
                if (typeof ingredient.price === 'number' && Number.isFinite(ingredient.price)) {
                    totalCost += ingredient.price * quantity;
                }
                // Collecter les allergènes
                if (Array.isArray(ingredient.allergens)) {
                    ingredient.allergens.forEach(a => allergenSet.add(a));
                }
            }
        }
    });

    const costPerServing = servings > 0 ? totalCost / servings : 0;
    const salePriceHT = costPerServing * multiplier;
    const salePriceTTC = salePriceHT * (1 + VAT_RATE);

    // Création d'un objet recette temporaire pour les calculs
    const tempRecipe = {
        servings,
        multiplier,
        productionTime,
        ingredients: []
    };
    form.querySelectorAll('.ingredient-row').forEach(row => {
        const ingredientId = parseInt(row.querySelector('.ingredient-select').value);
        const quantity = parseFloat(row.querySelector('.ingredient-quantity').value);
        if (ingredientId && quantity > 0) {
            tempRecipe.ingredients.push({ ingredientId, quantity });
        }
    });

    // Calculs de rentabilité (Prime Cost)
    const laborCostPerServing = calculateLaborCostPerServing(tempRecipe);
    const totalCostPerServing = calculateTotalCostPerServing(tempRecipe);
    const netMargin = calculateNetMargin(tempRecipe);
    const hourlyProfitability = calculateHourlyProfitability(tempRecipe);
    const suggestedPrice = calculateSuggestedPrice(tempRecipe);

    // Mise à jour des affichages de base
    document.getElementById('total-cost-display').textContent = formatCurrency3(totalCost);
    document.getElementById('cost-per-serving-display').textContent = formatCurrency3(costPerServing);
    document.getElementById('sale-price-ht-display').textContent = formatCurrency3(salePriceHT);
    document.getElementById('sale-price-ttc-display').textContent = formatCurrency3(salePriceTTC);

    // Mise à jour des affichages de rentabilité
    const laborCostEl = document.getElementById('labor-cost-display');
    const totalCostServingEl = document.getElementById('total-cost-serving-display');
    const netMarginEl = document.getElementById('net-margin-display');
    const hourlyProfitEl = document.getElementById('hourly-profit-display');
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
    if (margin >= 20) return 'value-positive';
    if (margin >= 10) return 'value-warning';
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
        previewEl.innerHTML = '<span class="no-allergen-preview">✓ Aucun allergène détecté</span>';
    } else {
        previewEl.innerHTML = `
            <span class="allergen-warning">⚠️ Allergènes détectés :</span>
            <div class="allergen-preview-list">
                ${allergens.map(a => `<span class="allergen-preview-item" title="${a.description}">${a.icon} ${a.name}</span>`).join('')}
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

    const recipeData = {
        id: recipeId ? parseInt(recipeId) : nextRecipeId(),
        name: form.querySelector('#recipe-name').value,
        servings: parseInt(form.querySelector('#recipe-servings').value),
        multiplier: parseFloat(form.querySelector('#recipe-multiplier').value),
        productionTime: productionTimeInput ? (parseInt(productionTimeInput.value) || 0) : 0,
        steps: form.querySelector('#recipe-steps').value || '',
        ingredients: []
    };

    form.querySelectorAll('.ingredient-row').forEach(row => {
        const ingredientId = parseInt(row.querySelector('.ingredient-select').value);
        const quantity = parseFloat(row.querySelector('.ingredient-quantity').value);
        if (ingredientId && quantity > 0) {
            recipeData.ingredients.push({ ingredientId, quantity });
        }
    });

    if (recipeId) {
        const index = recipes.findIndex(r => r.id == recipeId);
        recipes[index] = recipeData;
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
    const copy = {
        id: nextRecipeId(),
        name: `${original.name} (copie)`,
        servings: original.servings,
        multiplier: original.multiplier,
        productionTime: original.productionTime || 0,
        steps: original.steps || '',
        ingredients: JSON.parse(JSON.stringify(original.ingredients || []))
    };
    recipes.push(copy);
    saveData(recipes, mercuriale);
    renderRecipesTable();
    // Open the modal on the new copy so user can edit quickly
    showRecipeModal(copy.id);
}

function deleteRecipe(recipeId) {
    const recipe = recipes.find(r => r.id == recipeId);
    const name = recipe ? escapeHTML(recipe.name) : 'cette recette';
    showConfirm(`Supprimer la recette <strong>${name}</strong> ?`, () => {
        const idx = recipes.findIndex(r => r.id == recipeId);
        if (idx !== -1) {
            recipes.splice(idx, 1);
            saveData(recipes, mercuriale);
        }
        renderRecipesTable();
        showToast('Recette supprimée.', 'warning');
    }, {
        title: 'Supprimer une recette',
        confirmLabel: 'Supprimer',
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

    const totalCost = calculateRecipeCost(recipe);
    const costPerServing = recipe.servings > 0 ? totalCost / recipe.servings : 0;
    const salePriceHT = costPerServing * (recipe.multiplier || 0);
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
                <span class="allergen-pill-icon">${a.icon}</span>
                <span class="allergen-pill-name">${escapeHTML(a.name)}</span>
            </span>
          `).join('')
        : '<span class="allergen-pill allergen-pill-none">✓ Aucun allergène détecté</span>';

    // Ingrédients table rows
    let ingredientsRowsHtml = '';
    if (!recipe.ingredients || recipe.ingredients.length === 0) {
        ingredientsRowsHtml = `<tr><td colspan="5" class="text-center text-muted" style="padding:2rem;">Aucun ingrédient dans cette recette.</td></tr>`;
    } else {
        recipe.ingredients.forEach(item => {
            const ing = getIngredientById(item.ingredientId);
            if (ing) {
                const ingPrice = ing.price || 0;
                const cost = ingPrice * item.quantity;
                const hasAllergens = ing.allergens && ing.allergens.length > 0;
                const allergenBadge = hasAllergens
                    ? `<span style="color:#ef4444;" title="${escapeHTML(ing.allergens.join(', '))}">⚠️ ${escapeHTML(ing.allergens.join(', '))}</span>`
                    : '<span style="color:#94a3b8;">—</span>';

                ingredientsRowsHtml += `
                    <tr>
                        <td style="font-weight: 600;">${escapeHTML(ing.name)}</td>
                        <td class="text-center font-mono">${formatQuantityInput(item.quantity, ing.unit)} ${escapeHTML(ing.unit)}</td>
                        <td class="text-right font-mono">${formatCurrency3(ingPrice)} / ${escapeHTML(ing.unit)}</td>
                        <td class="text-right font-mono" style="font-weight: 700;">${formatCurrency3(cost)}</td>
                        <td class="text-center font-mono">${allergenBadge}</td>
                    </tr>
                `;
            }
        });
    }

    // Diagnostics / Alerte conviviale
    let alertClass = 'alert-success';
    let alertTitle = '🌟 Alerte conviviale';
    let alertMessage = 'La recette est très rentable et peut être vendue au prix appliqué sans risque de perte.';
    let statusClass = 'status-high';
    let statusText = '25% cible atteinte ✅';
    let progressClass = 'fill-high';

    if (!recipe.productionTime || recipe.productionTime <= 0) {
        alertClass = '';
        alertTitle = '💡 Temps de production non renseigné';
        alertMessage = 'Renseignez le temps de production en modifiant la recette pour débloquer le diagnostic du Prime Cost SAS et la rentabilité horaire.';
        statusClass = 'status-medium';
        statusText = 'Temps de production non renseigné';
        progressClass = 'fill-medium';
    } else if (netMargin >= 20) {
        alertClass = 'alert-success';
        alertTitle = '🌟 Alerte conviviale';
        alertMessage = `Excellente rentabilité ! La recette couvre tous ses coûts et dégage ${formatCurrency(hourlyProfit)}/h de bénéfice net.`;
        statusClass = 'status-high';
        statusText = `${formatPercent(netMargin)} — Marge cible atteinte ✅`;
        progressClass = 'fill-high';
    } else if (netMargin >= 0) {
        alertClass = '';
        alertTitle = '💡 Diagnostic rentabilité';
        alertMessage = `La recette est bénéficiaire mais sous la marge cible de 25%. Prix suggéré : ${formatCurrency(suggestedPrice.ht)} HT (${formatCurrency(suggestedPrice.ttc)} TTC).`;
        statusClass = 'status-medium';
        statusText = `${formatPercent(netMargin)} — Sous l'objectif de 25% ⚠️`;
        progressClass = 'fill-medium';
    } else {
        alertClass = 'alert-danger';
        alertTitle = '⚠️ Attention rentabilité';
        alertMessage = `Cette recette est vendue à perte après déduction de la main d'œuvre et des frais. Prix suggéré : ${formatCurrency(suggestedPrice.ht)} HT.`;
        statusClass = 'status-low';
        statusText = `${formatPercent(netMargin)} — Recette déficitaire ❌`;
        progressClass = 'fill-low';
    }

    const marginPercentValue = Math.min(100, Math.max(0, netMargin > 0 ? netMargin : 0));

    content.innerHTML = `
        <div class="recipe-modal-header">
            <div class="recipe-modal-title-area">
                <h2>${escapeHTML(recipe.name)}</h2>
                <div class="recipe-modal-subtitle">
                    <span class="recipe-meta-pill">🍽️ ${recipe.servings || 1} portion${(recipe.servings || 1) > 1 ? 's' : ''}</span>
                    <span class="recipe-meta-pill">⏱️ ${recipe.productionTime ? formatDuration(recipe.productionTime) : 'Temps N/A'}</span>
                    <span class="recipe-meta-pill">📐 Coeff. Multiplicateur : ${recipe.multiplier || 1}</span>
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
                <span class="kpi-banner-sub">MO & Frais inclus</span>
            </div>
            <div class="kpi-banner-card ${netMargin >= 20 ? 'kpi-green' : (netMargin >= 10 ? 'kpi-amber' : 'kpi-red')}">
                <span class="kpi-banner-label">Marge nette</span>
                <span class="kpi-banner-value">${recipe.productionTime > 0 ? formatPercent(netMargin) : 'N/A'}</span>
                <span class="kpi-banner-sub">Marge cible : 25%</span>
            </div>
            <div class="kpi-banner-card kpi-purple">
                <span class="kpi-banner-label">Prix conseillé</span>
                <span class="kpi-banner-value">${recipe.productionTime > 0 && recipe.servings > 0 ? formatCurrency(suggestedPrice.ht) + ' HT' : 'N/A'}</span>
                <span class="kpi-banner-sub">${recipe.productionTime > 0 && recipe.servings > 0 ? formatCurrency(suggestedPrice.ttc) + ' TTC' : 'Calculé sur 25% de marge'}</span>
            </div>
        </div>

        <!-- Main 2 Column Grid -->
        <div class="recipe-details-main-grid">
            <!-- Left Column: Details & Ingredients -->
            <div class="recipe-details-left-panel">
                <div class="recipe-panel-card">
                    <div class="recipe-panel-header">
                        <span>📋 Détail de la recette</span>
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
                        <span>⚠️ Allergènes détectés</span>
                    </div>
                    <div class="allergens-pills-container">
                        ${allergensPillsHtml}
                    </div>
                </div>

                ${recipe.steps ? `
                <div class="recipe-panel-card">
                    <div class="recipe-panel-header">
                        <span>📝 Étapes de préparation</span>
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
                            <span>📈 Rentabilité</span>
                        </div>

                        <div class="rentability-hero-price">
                            <div class="rentability-price-label">Prix de vente HT</div>
                            <div class="rentability-price-value-ht">${formatCurrency3(salePriceHT)}</div>
                            <div class="rentability-price-value-ttc">TTC : ${formatCurrency3(salePriceTTC)}</div>
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
                        <button type="button" id="details-edit-btn" class="button-primary" title="Modifier la recette">✏️ Modifier</button>
                        <button type="button" id="details-duplicate-btn" class="button-secondary" title="Dupliquer la recette">📋 Dupliquer</button>
                        <button type="button" id="details-print-btn" class="button-secondary" title="Imprimer la fiche technique">🖨️ Imprimer</button>
                        <button type="button" id="details-delete-btn" class="button-danger" title="Supprimer la recette">🗑️</button>
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
    if (printBtn) printBtn.onclick = () => { window.print(); };

    const deleteBtn = document.getElementById('details-delete-btn');
    if (deleteBtn) deleteBtn.onclick = () => {
        modal.style.display = 'none';
        deleteRecipe(recipeId);
    };

    modal.style.display = 'flex';
}