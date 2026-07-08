import {
    mercuriale, recipes, VAT_RATE,
    getIngredientById, calculateRecipeCost, saveData,
    EU_ALLERGENS, DEFAULT_HOURLY_RATE,
    calculateLaborCostPerServing, calculateTotalCostPerServing,
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
    document.getElementById('add-ingredient-row-btn').addEventListener('click', () => addIngredientRow());

    // Fermeture par Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const recipeModal = document.getElementById('recipe-modal');
            const allergenModal = document.getElementById('allergen-modal');
            if (recipeModal && recipeModal.style.display !== 'none') recipeModal.style.display = 'none';
            if (allergenModal && allergenModal.style.display !== 'none') allergenModal.style.display = 'none';
        }
    });
    // Fermeture en cliquant sur l'overlay
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

    // Listen for input changes within the form to update costs in real-time
    form.addEventListener('input', (e) => {
        if (e.target.matches('#recipe-servings, #recipe-multiplier, #recipe-production-time, #recipe-hourly-rate, .ingredient-quantity, .ingredient-select')) {
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
            <td data-label="Actions" class="action-cell">
                <button class="duplicate-btn" data-id="${recipe.id}">Dupliquer</button>
                <button class="edit-btn" data-id="${recipe.id}">Modifier</button>
                <button class="delete-btn" data-id="${recipe.id}">Supprimer</button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    tableBody.querySelectorAll('.duplicate-btn').forEach(btn => btn.addEventListener('click', (e) => duplicateRecipe(e.target.dataset.id)));
    tableBody.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', (e) => showRecipeModal(e.target.dataset.id)));
    tableBody.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', (e) => deleteRecipe(e.target.dataset.id)));

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

    const icons = allergens.slice(0, 3).map(a => a.icon).join('');
    const moreCount = allergens.length > 3 ? `+${allergens.length - 3}` : '';

    return `<button type="button" class="allergen-indicator" data-recipe-id="${recipeId}" title="Contient ${allergens.length} allergène(s) - Cliquer pour détails">
        ⚠️ ${icons}${moreCount}
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

    // Reset hourly rate to default
    const hourlyRateInput = document.getElementById('recipe-hourly-rate');
    if (hourlyRateInput) {
        hourlyRateInput.value = DEFAULT_HOURLY_RATE;
    }

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
    const hourlyRate = parseFloat(form.querySelector('#recipe-hourly-rate')?.value) || DEFAULT_HOURLY_RATE;

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

    // Calculs de rentabilité
    const laborCostPerServing = calculateLaborCostPerServing(tempRecipe, hourlyRate);
    const totalCostPerServing = calculateTotalCostPerServing(tempRecipe, hourlyRate);
    const netMargin = calculateNetMargin(tempRecipe, hourlyRate);
    const hourlyProfitability = calculateHourlyProfitability(tempRecipe, hourlyRate);
    const suggestedPrice = calculateSuggestedPrice(tempRecipe, hourlyRate);

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
    const suggestedPriceEl = document.getElementById('suggested-price-display');

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
    if (suggestedPriceEl) {
        suggestedPriceEl.textContent = productionTime > 0 && servings > 0 ? formatCurrency(suggestedPrice) : 'N/A';
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