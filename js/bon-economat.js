import {
    recipes, VAT_RATE, getIngredientById, calculateRecipeCost, calculateIngredientWeightKg
} from '../data.js';
import {
    roundCurrency, formatCurrency, formatUnitPrice, formatQuantity, formatQuantityPlain,
    formatWeight, formatRate, escapeHTML, convertUnitQuantity
} from './common.js';
import { showToast } from './ui-feedback.js';

let selectorCounter = 0;

export function initBonEconomatPage() {
    const addRecipeBtn = document.getElementById('add-recipe-selector-btn');
    const generateBtn = document.getElementById('generate-btn');

    updateDynamicVatLabel();
    addRecipeSelector(); // Add the first selector
    addRecipeBtn.addEventListener('click', () => addRecipeSelector());
    generateBtn.addEventListener('click', generateBonEconomat);
    document.getElementById('export-csv-btn').addEventListener('click', exportToCSV);

    const exportTxtBtn = document.getElementById('export-txt-btn');
    if (exportTxtBtn) {
        exportTxtBtn.addEventListener('click', exportToTXT);
    }
    const exportFixedTxtBtn = document.getElementById('export-fixed-txt-btn');
    if (exportFixedTxtBtn) {
        exportFixedTxtBtn.addEventListener('click', exportToFixedTXT);
    }
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', () => printBonExport('full'));
    }

    document.getElementById('summary-breakdown').addEventListener('click', event => {
        const button = event.target.closest('[data-print-mode]');
        if (button) {
            printBonExport(button.dataset.printMode);
        }
    });
    document.getElementById('detailed-breakdown').addEventListener('click', event => {
        const button = event.target.closest('[data-export-format]');
        if (!button) return;

        const recipeIndex = Number(button.dataset.recipeIndex);
        const format = button.dataset.exportFormat;
        if (format === 'pdf') {
            printBonExport('recipe', recipeIndex);
        } else {
            exportRecipe(recipeIndex, format);
        }
    });
}

export function refreshBonEconomatPage() {
    updateDynamicVatLabel();

    // Mettre à jour les options de chaque sélecteur tout en préservant les choix en cours
    const optionsHTML = buildRecipeSelectOptionsHTML();
    document.querySelectorAll('.recipe-selector-row .recipe-select').forEach(select => {
        const prevVal = select.value;
        select.innerHTML = optionsHTML;
        if (prevVal && Array.from(select.options).some(opt => opt.value === prevVal)) {
            select.value = prevVal;
        }
    });

    // Recalculer automatiquement si un bon d'économat est déjà affiché
    const resultsContainer = document.getElementById('bon-economat-results');
    if (resultsContainer && !resultsContainer.classList.contains('hidden')) {
        const selections = getSelectionsFromUI();
        if (selections.length > 0) {
            const bonData = calculateBonData(selections);
            resultsContainer.dataset.bonData = JSON.stringify(bonData);
            renderBonEconomat(bonData);
        } else {
            resultsContainer.classList.add('hidden');
            delete resultsContainer.dataset.bonData;
        }
    }
}

function updateDynamicVatLabel() {
    const ttcLabel = document.getElementById('quote-ttc-label');
    if (ttcLabel) {
        ttcLabel.textContent = `Chiffre d'Affaires TTC (TVA ${formatRate(VAT_RATE * 100)})`;
    }
}

function buildRecipeSelectOptionsHTML() {
    return `<option value="">Choisir une recette...</option>` +
        [...recipes]
            .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
            .map(r => `<option value="${r.id}">${escapeHTML(r.name)} (${r.servings || 1} portion${(r.servings || 1) > 1 ? 's' : ''})</option>`)
            .join('');
}

function addRecipeSelector() {
    const container = document.getElementById('recipe-selection-area');
    const selectorId = `recipe-selector-${++selectorCounter}`;

    const selectorHTML = `
        <div class="recipe-selector-row" id="${selectorId}">
            <div class="selector-field selector-field-main">
                <label class="field-label">Recette à confectionner</label>
                <select class="recipe-select">
                    ${buildRecipeSelectOptionsHTML()}
                </select>
            </div>
            <div class="selector-field selector-field-qty">
                <label class="field-label">Nombre de portions (N)</label>
                <input type="number" class="portions-input" placeholder="Ex: 1" min="1" step="1" value="1">
            </div>
            <div class="selector-field selector-field-btn">
                <button type="button" class="delete-selector-btn button-danger-subtle" title="Supprimer cette ligne" aria-label="Supprimer cette ligne"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg></button>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', selectorHTML);

    const newSelector = document.getElementById(selectorId);
    newSelector.querySelector('.delete-selector-btn').addEventListener('click', () => {
        if (container.children.length > 1) {
            newSelector.remove();
        } else {
            showToast('Vous devez conserver au moins une ligne de sélection.', 'warning');
        }
    });
}

function generateBonEconomat() {
    const selections = getSelectionsFromUI();

    if (selections.length === 0) {
        showToast('Veuillez sélectionner au moins une recette et indiquer le nombre de portions.', 'warning');
        return;
    }

    const bonData = calculateBonData(selections);
    const resultsEl = document.getElementById('bon-economat-results');
    resultsEl.dataset.bonData = JSON.stringify(bonData);
    renderBonEconomat(bonData);
}

function getSelectionsFromUI() {
    const selections = [];
    document.querySelectorAll('.recipe-selector-row').forEach(row => {
        const recipeId = row.querySelector('.recipe-select').value;
        const portions = parseInt(row.querySelector('.portions-input').value, 10);
        if (recipeId && !isNaN(portions) && portions > 0) {
            selections.push({ recipeId: parseInt(recipeId, 10), portions });
        }
    });
    return selections;
}

function processRecipeItems(items, portionMultiplier, recipeDetails, summary, visited, recipeExcludedSet, globalExcludedSet, globalVolumeTracker) {
    items.forEach(item => {
        const itemQty = parseFloat(item.quantity) || 0;
        if (itemQty <= 0) return;

        if (item.isSubRecipe || item.type === 'subrecipe' || item.subRecipeId) {
            const subId = parseInt(item.subRecipeId || item.ingredientId, 10);
            if (visited.has(subId)) return;
            const newVisited = new Set(visited);
            newVisited.add(subId);

            const subRecipe = recipes.find(r => parseInt(r.id, 10) === subId);
            if (subRecipe) {
                const subServings = Math.max(1, parseFloat(subRecipe.servings) || 1);
                const subPortionMultiplier = (itemQty * portionMultiplier) / subServings;
                processRecipeItems(
                    subRecipe.ingredients || [],
                    subPortionMultiplier,
                    recipeDetails,
                    summary,
                    newVisited,
                    recipeExcludedSet,
                    globalExcludedSet,
                    globalVolumeTracker
                );
            } else {
                const missingLabel = `Sous-recette #${subId}`;
                recipeExcludedSet.add(missingLabel);
                globalExcludedSet.add(missingLabel);
            }
        } else if (item.ingredientId) {
            const ingredient = getIngredientById(item.ingredientId);
            if (!ingredient) {
                const missingLabel = `Ingrédient #${item.ingredientId}`;
                recipeExcludedSet.add(missingLabel);
                globalExcludedSet.add(missingLabel);
                return;
            }

            const ingUnit = ingredient.unit;
            const recipeUnit = item.unit || ingUnit;

            const requiredInRecipeUnit = itemQty * portionMultiplier;
            const requiredInBaseUnit = convertUnitQuantity(requiredInRecipeUnit, recipeUnit, ingUnit);

            const yieldPct = (typeof ingredient.yield === 'number' && ingredient.yield > 0) ? ingredient.yield : 100;
            const basePrice = (typeof ingredient.price === 'number' && Number.isFinite(ingredient.price)) ? ingredient.price : 0;
            const effectivePrice = basePrice / (yieldPct / 100);
            const cost = effectivePrice * requiredInBaseUnit;

            const weightRes = calculateIngredientWeightKg(ingredient, requiredInRecipeUnit, recipeUnit);
            const itemWeightKg = weightRes.excluded ? 0 : weightRes.weightKg;

            if (weightRes.excluded) {
                recipeExcludedSet.add(ingredient.name);
                globalExcludedSet.add(ingredient.name);
            }
            if (weightRes.volumeApproxUsed) {
                recipeDetails.volumeApproxUsed = true;
                globalVolumeTracker.used = true;
            }

            recipeDetails.ingredients.push({
                name: ingredient.name,
                quantity: requiredInBaseUnit,
                unit: ingUnit,
                unitPrice: effectivePrice,
                totalCost: cost,
                weightKg: itemWeightKg,
                weightExcluded: weightRes.excluded
            });
            recipeDetails.totalCost += cost;
            recipeDetails.totalWeightKg += itemWeightKg;

            if (summary.has(ingredient.id)) {
                const existing = summary.get(ingredient.id);
                existing.quantity += requiredInBaseUnit;
                existing.totalCost += cost;
                existing.weightKg += itemWeightKg;
                if (weightRes.excluded) existing.weightExcluded = true;
            } else {
                summary.set(ingredient.id, {
                    id: ingredient.id,
                    name: ingredient.name,
                    quantity: requiredInBaseUnit,
                    unit: ingUnit,
                    totalCost: cost,
                    weightKg: itemWeightKg,
                    weightExcluded: weightRes.excluded,
                    family: ingredient.family
                });
            }
        }
    });
}

export function calculateBonData(selections) {
    const detailed = [];
    const summary = new Map();
    const globalExcludedSet = new Set();
    const globalVolumeTracker = { used: false };
    let totalPortions = 0;
    let globalTotalCost = 0;
    let globalTotalWeightKg = 0;
    let totalSalePriceHT = 0;
    let totalSalePriceTTC = 0;

    selections.forEach(({ recipeId, portions }) => {
        const numPortions = parseFloat(portions);
        if (!Number.isFinite(numPortions) || numPortions <= 0) return;

        const targetRecipeId = parseInt(recipeId, 10);
        const recipe = recipes.find(r => parseInt(r.id, 10) === targetRecipeId);
        const baseServings = parseFloat(recipe?.servings);
        if (!recipe || !Number.isFinite(baseServings) || baseServings <= 0) return;

        const portionMultiplier = numPortions / baseServings;
        const recipeExcludedSet = new Set();
        const recipeDetails = {
            recipeId: recipe.id,
            name: recipe.name,
            portions: numPortions,
            baseServings,
            ingredients: [],
            totalCost: 0,
            costPerPortion: 0,
            totalWeightKg: 0,
            weightPerPortionKg: 0,
            excludedWeightCount: 0,
            excludedWeightNames: [],
            volumeApproxUsed: false
        };

        processRecipeItems(
            recipe.ingredients || [],
            portionMultiplier,
            recipeDetails,
            summary,
            new Set([parseInt(recipe.id, 10)]),
            recipeExcludedSet,
            globalExcludedSet,
            globalVolumeTracker
        );

        recipeDetails.costPerPortion = recipeDetails.totalCost / numPortions;
        recipeDetails.weightPerPortionKg = recipeDetails.totalWeightKg / numPortions;
        recipeDetails.excludedWeightNames = [...recipeExcludedSet].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
        recipeDetails.excludedWeightCount = recipeDetails.excludedWeightNames.length;

        // Calcul du prix de vente pour cette recette
        const recipeTotalCost = calculateRecipeCost(recipe);
        const costPerServing = baseServings > 0 ? recipeTotalCost / baseServings : 0;
        const multiplier = Math.max(0, parseFloat(recipe.multiplier) || 0);
        const salePriceHTPerServing = costPerServing * multiplier;
        const salePriceTTCPerServing = salePriceHTPerServing * (1 + VAT_RATE);

        totalSalePriceHT += salePriceHTPerServing * numPortions;
        totalSalePriceTTC += salePriceTTCPerServing * numPortions;

        detailed.push(recipeDetails);
        totalPortions += numPortions;
        globalTotalCost += recipeDetails.totalCost;
        globalTotalWeightKg += recipeDetails.totalWeightKg;
    });

    const summaryList = Array.from(summary.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
    const summaryExcludedWeightNames = [...globalExcludedSet].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

    return {
        detailed,
        summary: summaryList,
        totalPortions,
        globalTotalCost,
        globalTotalWeightKg,
        summaryExcludedWeightCount: summaryExcludedWeightNames.length,
        summaryExcludedWeightNames,
        globalVolumeApproxUsed: globalVolumeTracker.used,
        totalSalePriceHT,
        totalSalePriceTTC
    };
}

function buildWeightNoteText(excludedWeightNames, volumeApproxUsed) {
    const notes = [];
    if (Array.isArray(excludedWeightNames) && excludedWeightNames.length > 0) {
        notes.push(`Poids partiel : ${excludedWeightNames.length} denrée(s) sans poids unitaire renseigné en mercuriale (${excludedWeightNames.join(', ')}).`);
    }
    if (volumeApproxUsed) {
        notes.push('Liquides comptés à 1 L = 1 kg (approximation standard).');
    }
    return notes;
}

function buildWeightFootnoteHTML(excludedWeightNames, volumeApproxUsed, className = 'bon-print-note') {
    const notes = buildWeightNoteText(excludedWeightNames, volumeApproxUsed);
    if (notes.length === 0) return '';
    return `<p class="${className}">${notes.map(n => escapeHTML(n)).join('<br>')}</p>`;
}

function formatPortionUnitKgWithGrams(weightPerPortionKg) {
    if (typeof weightPerPortionKg !== 'number' || !Number.isFinite(weightPerPortionKg) || weightPerPortionKg <= 0) {
        return '—';
    }
    const grams = Math.round(weightPerPortionKg * 1000);
    const gramsStr = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(grams);
    return `kg (${gramsStr} g)`;
}

function renderBonEconomat(bonData) {
    const {
        detailed, summary, totalPortions, globalTotalCost, globalTotalWeightKg,
        summaryExcludedWeightNames, globalVolumeApproxUsed,
        totalSalePriceHT, totalSalePriceTTC
    } = bonData;

    updateDynamicVatLabel();

    const detailedContainer = document.getElementById('detailed-breakdown');
    const summaryTable = document.getElementById('summary-table');
    const summaryTbody = summaryTable.querySelector('tbody');

    // 1. Détail par Recette
    detailedContainer.innerHTML = '<h3 class="section-title">Détail par Recette</h3>';
    detailed.forEach((recipe, recipeIndex) => {
        const portionLabel = `${recipe.portions} portion${recipe.portions > 1 ? 's' : ''}`;
        const weightTotalDisplay = recipe.totalWeightKg > 0 ? formatWeight(recipe.totalWeightKg) : '—';
        const weightPortionDisplay = recipe.weightPerPortionKg > 0 ? formatWeight(recipe.weightPerPortionKg, { includeGrams: true }) : '—';
        const footnoteHTML = buildWeightFootnoteHTML(recipe.excludedWeightNames, recipe.volumeApproxUsed, 'bon-table-note');

        let tableHTML = `
            <div class="card bon-recipe-card" id="recipe-breakdown-${recipeIndex}">
                <div class="recipe-card-header">
                    <div>
                        <h4 class="recipe-card-title">${escapeHTML(recipe.name)}</h4>
                        <div class="recipe-card-meta">
                            <span class="recipe-meta-item">Portions : <strong>${portionLabel}</strong></span>
                            <span class="recipe-meta-item">Poids total : <strong>${weightTotalDisplay}</strong></span>
                            <span class="recipe-meta-item">Par portion : <strong>${weightPortionDisplay}</strong> | <strong>${formatCurrency(recipe.costPerPortion)} HT</strong></span>
                        </div>
                    </div>
                    <span class="badge-recipe-cost">Coût Recette : ${formatCurrency(recipe.totalCost)}</span>
                </div>
                <div class="export-actions recipe-export-actions">
                    <button type="button" class="button-secondary" data-export-format="csv" data-recipe-index="${recipeIndex}">CSV</button>
                    <button type="button" class="button-secondary" data-export-format="txt" data-recipe-index="${recipeIndex}">TXT Tabulé</button>
                    <button type="button" class="button-secondary" data-export-format="fixed-txt" data-recipe-index="${recipeIndex}">TXT Colonnes</button>
                    <button type="button" class="button-secondary" data-export-format="pdf" data-recipe-index="${recipeIndex}">PDF Recette</button>
                </div>
                <div class="table-container">
                    <table class="bon-table">
                        <thead>
                            <tr>
                                <th style="width: 38%;">Intitulé ingrédient</th>
                                <th style="width: 15%; text-align: right;">Quantité</th>
                                <th style="width: 15%; text-align: center;">Unité</th>
                                <th style="width: 16%; text-align: right;">Prix unitaire HT</th>
                                <th style="width: 16%; text-align: right;">Coût total HT</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        recipe.ingredients.forEach(ing => {
            tableHTML += `
                <tr>
                    <td data-label="Intitulé"><strong>${escapeHTML(ing.name)}</strong></td>
                    <td data-label="Quantité" style="text-align: right;"><span class="badge-qty">${formatQuantity(ing.quantity, ing.unit)}</span></td>
                    <td data-label="Unité" style="text-align: center;"><span class="badge-unit">${escapeHTML(ing.unit)}</span></td>
                    <td data-label="Prix unitaire HT" style="text-align: right;" class="tabular-price">${formatUnitPrice(ing.unitPrice)}</td>
                    <td data-label="Coût total HT" style="text-align: right;" class="tabular-price-bold">${formatCurrency(ing.totalCost)}</td>
                </tr>
            `;
        });
        tableHTML += `
                        </tbody>
                        <tfoot>
                            <tr>
                                <td style="font-weight: 700;">Total recette (${portionLabel})</td>
                                <td style="text-align: right; font-weight: 700;" class="tabular-price-bold">${recipe.totalWeightKg > 0 ? formatWeight(recipe.totalWeightKg, { withUnit: false }) : '—'}</td>
                                <td style="text-align: center; font-weight: 600;">${recipe.totalWeightKg > 0 ? 'kg' : '—'}</td>
                                <td style="text-align: right;">—</td>
                                <td style="text-align: right; font-weight: 800;" class="tabular-price-bold">${formatCurrency(recipe.totalCost)}</td>
                            </tr>
                            <tr class="portion-row">
                                <td style="font-weight: 600;">Par portion (1 portion)</td>
                                <td style="text-align: right; font-weight: 600;" class="tabular-price">${recipe.weightPerPortionKg > 0 ? formatWeight(recipe.weightPerPortionKg, { withUnit: false }) : '—'}</td>
                                <td style="text-align: center; font-weight: 600;">${escapeHTML(formatPortionUnitKgWithGrams(recipe.weightPerPortionKg))}</td>
                                <td style="text-align: right;">—</td>
                                <td style="text-align: right; font-weight: 700;" class="tabular-price-bold">${formatCurrency(recipe.costPerPortion)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                ${footnoteHTML}
            </div>
        `;
        detailedContainer.insertAdjacentHTML('beforeend', tableHTML);
    });

    // 2. Récapitulatif Global des Denrées
    summaryTbody.innerHTML = '';
    summary.forEach(item => {
        const row = `
            <tr>
                <td data-label="Denrée"><strong>${escapeHTML(item.name)}</strong></td>
                <td data-label="Quantité" style="text-align: right;"><span class="badge-qty">${formatQuantity(item.quantity, item.unit)}</span></td>
                <td data-label="Unité" style="text-align: center;"><span class="badge-unit">${escapeHTML(item.unit)}</span></td>
                <td data-label="Coût HT" style="text-align: right;" class="tabular-price-bold">${formatCurrency(item.totalCost)}</td>
            </tr>
        `;
        summaryTbody.insertAdjacentHTML('beforeend', row);
    });

    let summaryTfoot = summaryTable.querySelector('tfoot');
    if (!summaryTfoot) {
        summaryTfoot = document.createElement('tfoot');
        summaryTable.appendChild(summaryTfoot);
    }
    summaryTfoot.innerHTML = `
        <tr>
            <td style="font-weight: 700;">Total (${summary.length} denrée${summary.length > 1 ? 's' : ''})</td>
            <td style="text-align: right; font-weight: 700;" class="tabular-price-bold">${globalTotalWeightKg > 0 ? formatWeight(globalTotalWeightKg, { withUnit: false }) : '—'}</td>
            <td style="text-align: center; font-weight: 600;">${globalTotalWeightKg > 0 ? 'kg (poids)' : '—'}</td>
            <td style="text-align: right; font-weight: 800;" class="tabular-price-bold">${formatCurrency(globalTotalCost)}</td>
        </tr>
    `;

    const summaryNoteEl = document.getElementById('summary-weight-note');
    if (summaryNoteEl) {
        const notes = buildWeightNoteText(summaryExcludedWeightNames, globalVolumeApproxUsed);
        summaryNoteEl.innerHTML = notes.map(n => escapeHTML(n)).join('<br>');
        summaryNoteEl.style.display = notes.length > 0 ? 'block' : 'none';
    }

    // 3. Totaux globaux et devis
    const quoteIngredientsCost = document.getElementById('quote-ingredients-cost');
    if (quoteIngredientsCost) quoteIngredientsCost.textContent = formatCurrency(globalTotalCost);

    document.getElementById('global-total-cost').textContent = formatCurrency(globalTotalCost);
    const globalTotalMeta = document.getElementById('global-total-meta');
    if (globalTotalMeta) {
        const weightPart = globalTotalWeightKg > 0 ? ` — Poids total : ${formatWeight(globalTotalWeightKg)}` : '';
        globalTotalMeta.textContent = `${detailed.length} recette${detailed.length > 1 ? 's' : ''} — ${totalPortions} portion${totalPortions > 1 ? 's' : ''}${weightPart}`;
    }

    document.getElementById('total-sale-price-ht').textContent = formatCurrency(totalSalePriceHT);
    document.getElementById('total-sale-price-ttc').textContent = formatCurrency(totalSalePriceTTC);

    const grossMargin = totalSalePriceHT - globalTotalCost;
    const marginPercent = totalSalePriceHT > 0 ? ((grossMargin / totalSalePriceHT) * 100).toFixed(1) : '0.0';

    const grossMarginElem = document.getElementById('total-gross-margin');
    if (grossMarginElem) {
        grossMarginElem.innerHTML = `${formatCurrency(grossMargin)} <small class="margin-percent-pill">(${marginPercent}%)</small>`;
    }

    const resultsCountBadge = document.getElementById('results-count-badge');
    if (resultsCountBadge) {
        const weightSuffix = globalTotalWeightKg > 0 ? ` • ${formatWeight(globalTotalWeightKg)}` : '';
        resultsCountBadge.textContent = `${summary.length} denrée${summary.length > 1 ? 's' : ''} • ${detailed.length} recette${detailed.length > 1 ? 's' : ''} • ${totalPortions} portion${totalPortions > 1 ? 's' : ''}${weightSuffix}`;
    }

    document.getElementById('bon-economat-results').classList.remove('hidden');
}

function getBonData() {
    const bonDataString = document.getElementById('bon-economat-results').dataset.bonData;
    if (!bonDataString) {
        showToast("Veuillez d'abord générer un bon d'économat.", 'warning');
        return null;
    }
    return JSON.parse(bonDataString);
}

// === UTILITAIRES D'EXPORT CSV / TXT ===

function csvEscape(value) {
    const str = String(value ?? '');
    if (/[",\r\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
}

function sanitizeTSVField(value) {
    return String(value ?? '').replace(/[\t\n\r]/g, ' ').trim();
}

function formatPlainCurrency(amount) {
    return roundCurrency(Number(amount || 0)).toFixed(2);
}

function formatPlainUnitPrice(amount) {
    const num = Number(amount || 0);
    if (!Number.isFinite(num) || num <= 0) return '0.00';
    if (num < 0.01) return num.toFixed(4);
    return roundCurrency(num).toFixed(2);
}

function formatPlainWeightKg(weightKg) {
    return (typeof weightKg === 'number' && Number.isFinite(weightKg) && weightKg > 0)
        ? weightKg.toFixed(3)
        : '';
}

export function buildRecipeExportContent(recipe, format) {
    const rows = (recipe.ingredients || []).map(item => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalCost: item.totalCost
    }));
    const portions = recipe.portions || 0;
    const totalWeightStr = formatPlainWeightKg(recipe.totalWeightKg);
    const portionWeightStr = formatPlainWeightKg(recipe.weightPerPortionKg);
    const portionGramsStr = recipe.weightPerPortionKg > 0 ? String(Math.round(recipe.weightPerPortionKg * 1000)) : '';

    if (format === 'csv') {
        const lines = [
            [
                csvEscape('Intitulé ingrédient'),
                csvEscape('Quantité'),
                csvEscape('Unité'),
                csvEscape('Prix unitaire HT'),
                csvEscape('Coût total HT')
            ].join(','),
            ...rows.map(item => [
                csvEscape(item.name),
                formatQuantityPlain(item.quantity, item.unit),
                csvEscape(item.unit),
                formatPlainUnitPrice(item.unitPrice),
                formatPlainCurrency(item.totalCost)
            ].join(',')),
            [
                csvEscape(`Total recette (${portions} portion${portions > 1 ? 's' : ''})`),
                totalWeightStr,
                csvEscape(totalWeightStr ? 'kg' : ''),
                '',
                formatPlainCurrency(recipe.totalCost)
            ].join(','),
            [
                csvEscape('Par portion (1 portion)'),
                portionWeightStr,
                csvEscape(portionWeightStr ? `kg (${portionGramsStr} g)` : ''),
                '',
                formatPlainCurrency(recipe.costPerPortion)
            ].join(',')
        ];
        return lines.join('\r\n');
    }

    if (format === 'txt') {
        const lines = [
            `Recette\t${sanitizeTSVField(recipe.name)}\tPortions\t${portions}`,
            ['Intitulé ingrédient', 'Quantité', 'Unité', 'Prix unitaire HT', 'Coût total HT'].join('\t'),
            ...rows.map(item => [
                sanitizeTSVField(item.name),
                formatQuantityPlain(item.quantity, item.unit),
                sanitizeTSVField(item.unit),
                formatPlainUnitPrice(item.unitPrice),
                formatPlainCurrency(item.totalCost)
            ].join('\t')),
            [`Total recette (${portions} portion${portions > 1 ? 's' : ''})`, totalWeightStr, totalWeightStr ? 'kg' : '', '', formatPlainCurrency(recipe.totalCost)].join('\t'),
            ['Par portion (1 portion)', portionWeightStr, portionWeightStr ? `kg (${portionGramsStr} g)` : '', '', formatPlainCurrency(recipe.costPerPortion)].join('\t')
        ];
        return lines.join('\r\n');
    }

    // fixed-txt
    const totalLabel = `Total recette (${portions} portion${portions > 1 ? 's' : ''})`;
    const portionLabel = 'Par portion (1 portion)';
    const nameWidth = Math.max(
        24,
        Math.min(40, Math.max('Intitulé ingrédient'.length, totalLabel.length, portionLabel.length, ...rows.map(item => String(item.name).length)))
    );
    const widths = [nameWidth, 16, 14, 16, 14];
    const trunc = (text, width) => (text.length <= width ? text : text.slice(0, width - 1) + '…');
    const padEnd = (value, width) => String(value).padEnd(width, ' ');
    const padStart = (value, width) => String(value).padStart(width, ' ');

    const header = [
        padEnd('Intitulé ingrédient', widths[0]),
        padStart('Quantité', widths[1]),
        padEnd('Unité', widths[2]),
        padStart('Prix unitaire HT', widths[3]),
        padStart('Coût total HT', widths[4])
    ].join('  ');
    const separator = widths.map(width => ''.padEnd(width, '-')).join('  ');
    const bodyRows = rows.map(item => [
        padEnd(trunc(sanitizeTSVField(item.name), widths[0]), widths[0]),
        padStart(formatQuantityPlain(item.quantity, item.unit), widths[1]),
        padEnd(trunc(sanitizeTSVField(item.unit), widths[2]), widths[2]),
        padStart(formatPlainUnitPrice(item.unitPrice), widths[3]),
        padStart(formatPlainCurrency(item.totalCost), widths[4])
    ].join('  '));
    const totalRow = [
        padEnd(trunc(totalLabel, widths[0]), widths[0]),
        padStart(totalWeightStr || '-', widths[1]),
        padEnd(totalWeightStr ? 'kg' : '-', widths[2]),
        padStart('-', widths[3]),
        padStart(formatPlainCurrency(recipe.totalCost), widths[4])
    ].join('  ');
    const portionRow = [
        padEnd(trunc(portionLabel, widths[0]), widths[0]),
        padStart(portionWeightStr || '-', widths[1]),
        padEnd(portionWeightStr ? `kg (${portionGramsStr} g)` : '-', widths[2]),
        padStart('-', widths[3]),
        padStart(formatPlainCurrency(recipe.costPerPortion), widths[4])
    ].join('  ');

    return [
        `Recette : ${sanitizeTSVField(recipe.name)} (${portions} portion${portions > 1 ? 's' : ''})`,
        '',
        header,
        separator,
        ...bodyRows,
        separator,
        totalRow,
        portionRow
    ].join('\r\n');
}

function exportRecipe(recipeIndex, format) {
    const bonData = getBonData();
    const recipe = bonData?.detailed?.[recipeIndex];
    if (!recipe) return;

    const baseName = `bon_economat_${recipe.name.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')}_${Date.now()}`;
    const content = buildRecipeExportContent(recipe, format);

    if (format === 'csv') {
        downloadTextFile('\uFEFF' + content, `${baseName}.csv`, 'text/csv;charset=utf-8');
    } else if (format === 'txt') {
        downloadTextFile(content, `${baseName}.txt`, 'text/tab-separated-values;charset=utf-8');
    } else if (format === 'fixed-txt') {
        downloadTextFile(content, `${baseName}_fixed.txt`, 'text/plain;charset=utf-8');
    }
}

export function buildGlobalCSVContent(bonData) {
    const lines = [];

    // Section 1 : Synthèse des recettes sélectionnées
    lines.push([
        csvEscape('Recette'),
        csvEscape('Portions'),
        csvEscape('Poids total (kg)'),
        csvEscape('Poids / portion (kg)'),
        csvEscape('Poids / portion (g)'),
        csvEscape('Coût / portion HT'),
        csvEscape('Coût total HT')
    ].join(','));

    (bonData.detailed || []).forEach(recipe => {
        lines.push([
            csvEscape(recipe.name),
            String(recipe.portions || 0),
            formatPlainWeightKg(recipe.totalWeightKg),
            formatPlainWeightKg(recipe.weightPerPortionKg),
            recipe.weightPerPortionKg > 0 ? String(Math.round(recipe.weightPerPortionKg * 1000)) : '',
            formatPlainCurrency(recipe.costPerPortion),
            formatPlainCurrency(recipe.totalCost)
        ].join(','));
    });

    lines.push([
        csvEscape(`Total (${(bonData.detailed || []).length} recette${(bonData.detailed || []).length > 1 ? 's' : ''})`),
        String(bonData.totalPortions || 0),
        formatPlainWeightKg(bonData.globalTotalWeightKg),
        '',
        '',
        '',
        formatPlainCurrency(bonData.globalTotalCost)
    ].join(','));

    lines.push('');

    // Section 2 : Récapitulatif global des denrées
    lines.push([
        csvEscape('Nom de la denrée'),
        csvEscape('Quantité totale'),
        csvEscape('Unité'),
        csvEscape('Coût total HT')
    ].join(','));

    [...(bonData.summary || [])]
        .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
        .forEach(item => {
            lines.push([
                csvEscape(item.name),
                formatQuantityPlain(item.quantity, item.unit),
                csvEscape(item.unit),
                formatPlainCurrency(item.totalCost)
            ].join(','));
        });

    const globalWeightStr = formatPlainWeightKg(bonData.globalTotalWeightKg);
    lines.push([
        csvEscape(`Total Global (${(bonData.summary || []).length} denrée${(bonData.summary || []).length > 1 ? 's' : ''})`),
        globalWeightStr,
        csvEscape(globalWeightStr ? 'kg (poids)' : ''),
        formatPlainCurrency(bonData.globalTotalCost)
    ].join(','));

    return lines.join('\r\n');
}

export function buildGlobalTXTContent(bonData) {
    const lines = [];

    lines.push(['Recette', 'Portions', 'Poids total (kg)', 'Poids / portion (kg)', 'Poids / portion (g)', 'Coût / portion HT', 'Coût total HT'].join('\t'));
    (bonData.detailed || []).forEach(recipe => {
        lines.push([
            sanitizeTSVField(recipe.name),
            String(recipe.portions || 0),
            formatPlainWeightKg(recipe.totalWeightKg),
            formatPlainWeightKg(recipe.weightPerPortionKg),
            recipe.weightPerPortionKg > 0 ? String(Math.round(recipe.weightPerPortionKg * 1000)) : '',
            formatPlainCurrency(recipe.costPerPortion),
            formatPlainCurrency(recipe.totalCost)
        ].join('\t'));
    });
    lines.push([
        `Total (${(bonData.detailed || []).length} recette${(bonData.detailed || []).length > 1 ? 's' : ''})`,
        String(bonData.totalPortions || 0),
        formatPlainWeightKg(bonData.globalTotalWeightKg),
        '',
        '',
        '',
        formatPlainCurrency(bonData.globalTotalCost)
    ].join('\t'));

    lines.push('');

    lines.push(['Nom de la denrée', 'Quantité totale', 'Unité', 'Coût total HT'].join('\t'));
    [...(bonData.summary || [])]
        .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
        .forEach(item => {
            lines.push([
                sanitizeTSVField(item.name),
                formatQuantityPlain(item.quantity, item.unit),
                sanitizeTSVField(item.unit),
                formatPlainCurrency(item.totalCost)
            ].join('\t'));
        });

    const globalWeightStr = formatPlainWeightKg(bonData.globalTotalWeightKg);
    lines.push([
        `Total Global (${(bonData.summary || []).length} denrée${(bonData.summary || []).length > 1 ? 's' : ''})`,
        globalWeightStr,
        globalWeightStr ? 'kg (poids)' : '',
        formatPlainCurrency(bonData.globalTotalCost)
    ].join('\t'));

    return lines.join('\r\n');
}

export function buildGlobalFixedTXTContent(bonData) {
    const trunc = (text, width) => (text.length <= width ? text : text.slice(0, width - 1) + '…');
    const padEnd = (text, width) => `${text}`.padEnd(width, ' ');
    const padStart = (text, width) => `${text}`.padStart(width, ' ');

    const blocks = [];

    // Bloc 1 : Synthèse des recettes
    const detailed = bonData.detailed || [];
    const recNameWidth = Math.max(20, Math.min(36, Math.max('Recette'.length, ...detailed.map(r => sanitizeTSVField(r.name).length))));
    const recWidths = [recNameWidth, 8, 12, 16, 13, 13];
    const recHeader = [
        padEnd('Recette', recWidths[0]),
        padStart('Portions', recWidths[1]),
        padStart('Poids (kg)', recWidths[2]),
        padStart('Poids / p.', recWidths[3]),
        padStart('Coût / p. HT', recWidths[4]),
        padStart('Coût total HT', recWidths[5])
    ].join('  ');
    const recSep = recWidths.map(w => ''.padEnd(w, '-')).join('  ');
    const recRows = detailed.map(r => {
        const portionWeightText = r.weightPerPortionKg > 0
            ? `${r.weightPerPortionKg.toFixed(3)} (${Math.round(r.weightPerPortionKg * 1000)}g)`
            : '-';
        return [
            padEnd(trunc(sanitizeTSVField(r.name), recWidths[0]), recWidths[0]),
            padStart(String(r.portions || 0), recWidths[1]),
            padStart(formatPlainWeightKg(r.totalWeightKg) || '-', recWidths[2]),
            padStart(portionWeightText, recWidths[3]),
            padStart(formatPlainCurrency(r.costPerPortion), recWidths[4]),
            padStart(formatPlainCurrency(r.totalCost), recWidths[5])
        ].join('  ');
    });
    const recTotal = [
        padEnd(trunc(`Total (${detailed.length} recette${detailed.length > 1 ? 's' : ''})`, recWidths[0]), recWidths[0]),
        padStart(String(bonData.totalPortions || 0), recWidths[1]),
        padStart(formatPlainWeightKg(bonData.globalTotalWeightKg) || '-', recWidths[2]),
        padStart('-', recWidths[3]),
        padStart('-', recWidths[4]),
        padStart(formatPlainCurrency(bonData.globalTotalCost), recWidths[5])
    ].join('  ');

    blocks.push(['SYNTHÈSE DES RECETTES', recHeader, recSep, ...recRows, recSep, recTotal].join('\r\n'));

    // Bloc 2 : Récapitulatif des denrées
    const sanitized = (bonData.summary || []).map(i => ({
        name: sanitizeTSVField(i.name),
        quantity: Number(i.quantity || 0),
        unit: sanitizeTSVField(i.unit),
        totalCost: Number(i.totalCost || 0)
    }));

    const nameHeader = 'Nom de la denrée';
    const qtyHeader = 'Quantité totale';
    const unitHeader = 'Unité';
    const costHeader = 'Coût total HT';

    const maxNameLen = Math.max(nameHeader.length, ...sanitized.map(i => i.name.length));
    const nameColWidth = Math.max(20, Math.min(40, maxNameLen));
    const qtyColWidth = Math.max(qtyHeader.length, 15);
    const unitColWidth = Math.max(unitHeader.length, 10);
    const costColWidth = Math.max(costHeader.length, 14);

    const header = [
        padEnd(nameHeader, nameColWidth),
        padStart(qtyHeader, qtyColWidth),
        padEnd(unitHeader, unitColWidth),
        padStart(costHeader, costColWidth)
    ].join('  ');

    const sep = [
        ''.padEnd(nameColWidth, '-'),
        ''.padEnd(qtyColWidth, '-'),
        ''.padEnd(unitColWidth, '-'),
        ''.padEnd(costColWidth, '-')
    ].join('  ');

    const rows = sanitized
        .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
        .map(i => [
            padEnd(trunc(i.name, nameColWidth), nameColWidth),
            padStart(formatQuantityPlain(i.quantity, i.unit), qtyColWidth),
            padEnd(trunc(i.unit, unitColWidth), unitColWidth),
            padStart(formatPlainCurrency(i.totalCost), costColWidth)
        ].join('  '));

    const globalWeightStr = formatPlainWeightKg(bonData.globalTotalWeightKg);
    const totalLine = [
        padEnd(trunc(`Total Global (${sanitized.length} denrée${sanitized.length > 1 ? 's' : ''})`, nameColWidth), nameColWidth),
        padStart(globalWeightStr || '-', qtyColWidth),
        padEnd(globalWeightStr ? 'kg (poids)' : '-', unitColWidth),
        padStart(formatPlainCurrency(bonData.globalTotalCost), costColWidth)
    ].join('  ');

    blocks.push(['RÉCAPITULATIF GLOBAL DES DENRÉES', header, sep, ...rows, sep, totalLine].join('\r\n'));

    return blocks.join('\r\n\r\n');
}

function downloadTextFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// === IMPRESSION PDF (ULTRA-SIMPLE, CARRÉ, NOIR & BLANC, 0 EMOJI) ===

function printBonExport(mode, recipeIndex = null) {
    const bonData = getBonData();
    if (!bonData) return;

    let documentHTML;
    if (mode === 'recipe') {
        const recipe = bonData.detailed?.[recipeIndex];
        if (!recipe) return;
        documentHTML = buildRecipePrintDocument(recipe);
    } else {
        documentHTML = buildGlobalPrintDocument(bonData, mode === 'summary');
    }

    const printFrame = document.createElement('iframe');
    printFrame.setAttribute('title', 'Document à imprimer');
    printFrame.className = 'bon-print-frame';
    document.body.appendChild(printFrame);

    let cleaned = false;
    const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        window.removeEventListener('afterprint', cleanup);
        if (printFrame.parentNode) {
            printFrame.remove();
        }
    };

    const printStyles = `
        @page { size: A4 portrait; margin: 12mm; }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            color: #000000;
            background: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 9pt;
            line-height: 1.35;
        }
        .bon-print-sheet { width: 100%; }
        .bon-print-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #000000;
            padding-bottom: 6pt;
            margin-bottom: 6pt;
        }
        .bon-print-header h1 {
            font-size: 15pt;
            margin: 0 0 2pt;
            text-transform: uppercase;
            letter-spacing: 0.02em;
        }
        .bon-print-header p { margin: 0; font-size: 9.5pt; color: #111111; }
        .bon-print-subtitle { margin: 0 0 10pt; font-size: 8.5pt; color: #333333; }
        .bon-print-meta { text-align: right; font-size: 8.5pt; }
        .bon-print-meta span { display: block; color: #333333; }
        .bon-print-sheet h2 {
            font-size: 10.5pt;
            margin: 12pt 0 5pt;
            padding-bottom: 2pt;
            border-bottom: 1px solid #000000;
            break-after: avoid;
            page-break-after: avoid;
        }
        .bon-print-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            margin: 0 0 6pt;
            border: 1px solid #000000;
        }
        .bon-print-table thead { display: table-header-group; }
        .bon-print-table tfoot { display: table-row-group; }
        .bon-print-table tr { break-inside: avoid; page-break-inside: avoid; }
        .bon-print-table th,
        .bon-print-table td {
            border: 1px solid #555555;
            padding: 4pt 5pt;
            text-align: left;
            vertical-align: middle;
            overflow-wrap: anywhere;
        }
        .bon-print-table thead th {
            background: #eeeeee;
            font-weight: 700;
            border-bottom: 1.5px solid #000000;
        }
        .bon-print-table tfoot th,
        .bon-print-table tfoot td {
            background: #f5f5f5;
            font-weight: 700;
            border-top: 1.5px solid #000000;
        }
        .bon-print-table tfoot tr.portion-row th,
        .bon-print-table tfoot tr.portion-row td {
            background: #ffffff;
            border-top: 1px solid #555555;
            font-weight: 600;
        }
        .bon-print-table .number { text-align: right; font-variant-numeric: tabular-nums; }
        .bon-print-table .center { text-align: center; }
        .bon-print-note {
            margin: 3pt 0 10pt;
            font-size: 7.5pt;
            color: #333333;
        }
        .bon-print-section {
            break-inside: auto;
            page-break-inside: auto;
            margin-top: 12pt;
        }
    `;

    printFrame.onload = () => {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.onafterprint = cleanup;
        printFrame.contentWindow.print();
    };

    window.addEventListener('afterprint', cleanup);

    const printDocument = printFrame.contentDocument;
    printDocument.open();
    printDocument.write(`<!doctype html><html lang="fr"><head><meta charset="UTF-8"><title>Bon d'économat</title><style>${printStyles}</style></head><body>${documentHTML}</body></html>`);
    printDocument.close();
}

function printDocumentHeader(title, subtitle) {
    return `
        <header class="bon-print-header">
            <div>
                <h1>Bon d'économat</h1>
                <p>${escapeHTML(title)}</p>
            </div>
            <div class="bon-print-meta">
                <span>Date d'édition</span>
                <strong>${new Date().toLocaleDateString('fr-FR')}</strong>
            </div>
        </header>
        <p class="bon-print-subtitle">${escapeHTML(subtitle)}</p>
    `;
}

export function buildRecipesSummaryPrintTable(bonData) {
    const detailed = bonData.detailed || [];
    return `
        <table class="bon-print-table">
            <colgroup>
                <col style="width: 30%;">
                <col style="width: 10%;">
                <col style="width: 14%;">
                <col style="width: 18%;">
                <col style="width: 14%;">
                <col style="width: 14%;">
            </colgroup>
            <thead>
                <tr>
                    <th>Recette</th>
                    <th class="number">Portions</th>
                    <th class="number">Poids total</th>
                    <th class="number">Poids / portion</th>
                    <th class="number">Coût / portion HT</th>
                    <th class="number">Coût total HT</th>
                </tr>
            </thead>
            <tbody>
                ${detailed.map(recipe => `
                    <tr>
                        <td>${escapeHTML(recipe.name)}</td>
                        <td class="number">${escapeHTML(String(recipe.portions))}</td>
                        <td class="number">${escapeHTML(formatWeight(recipe.totalWeightKg))}</td>
                        <td class="number">${escapeHTML(formatWeight(recipe.weightPerPortionKg, { includeGrams: true }))}</td>
                        <td class="number">${escapeHTML(formatCurrency(recipe.costPerPortion))}</td>
                        <td class="number">${escapeHTML(formatCurrency(recipe.totalCost))}</td>
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr>
                    <th>Total (${detailed.length} recette${detailed.length > 1 ? 's' : ''})</th>
                    <th class="number">${escapeHTML(String(bonData.totalPortions || 0))}</th>
                    <th class="number">${escapeHTML(formatWeight(bonData.globalTotalWeightKg))}</th>
                    <th class="number">—</th>
                    <th class="number">—</th>
                    <th class="number">${escapeHTML(formatCurrency(bonData.globalTotalCost))}</th>
                </tr>
            </tfoot>
        </table>
    `;
}

export function buildSummaryPrintTable(bonData) {
    const summary = [...(bonData.summary || [])].sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
    const globalWeightNum = bonData.globalTotalWeightKg > 0
        ? formatWeight(bonData.globalTotalWeightKg, { withUnit: false })
        : '—';
    const globalWeightUnit = bonData.globalTotalWeightKg > 0 ? 'kg (poids)' : '—';

    return `
        <table class="bon-print-table">
            <colgroup>
                <col style="width: 46%;">
                <col style="width: 18%;">
                <col style="width: 16%;">
                <col style="width: 20%;">
            </colgroup>
            <thead>
                <tr>
                    <th>Nom de la denrée</th>
                    <th class="number">Quantité totale</th>
                    <th class="center">Unité</th>
                    <th class="number">Coût total HT</th>
                </tr>
            </thead>
            <tbody>
                ${summary.map(item => `
                    <tr>
                        <td>${escapeHTML(item.name)}</td>
                        <td class="number">${escapeHTML(formatQuantity(item.quantity, item.unit))}</td>
                        <td class="center">${escapeHTML(item.unit)}</td>
                        <td class="number">${escapeHTML(formatCurrency(item.totalCost))}</td>
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr>
                    <th>Total (${summary.length} denrée${summary.length > 1 ? 's' : ''})</th>
                    <th class="number">${escapeHTML(globalWeightNum)}</th>
                    <th class="center">${escapeHTML(globalWeightUnit)}</th>
                    <th class="number">${escapeHTML(formatCurrency(bonData.globalTotalCost))}</th>
                </tr>
            </tfoot>
        </table>
    `;
}

export function buildRecipePrintTable(recipe) {
    const portions = recipe.portions || 0;
    const totalWeightNum = recipe.totalWeightKg > 0
        ? formatWeight(recipe.totalWeightKg, { withUnit: false })
        : '—';
    const totalWeightUnit = recipe.totalWeightKg > 0 ? 'kg' : '—';
    const portionWeightNum = recipe.weightPerPortionKg > 0
        ? formatWeight(recipe.weightPerPortionKg, { withUnit: false })
        : '—';
    const portionWeightUnit = formatPortionUnitKgWithGrams(recipe.weightPerPortionKg);

    return `
        <table class="bon-print-table">
            <colgroup>
                <col style="width: 38%;">
                <col style="width: 15%;">
                <col style="width: 15%;">
                <col style="width: 16%;">
                <col style="width: 16%;">
            </colgroup>
            <thead>
                <tr>
                    <th>Intitulé ingrédient</th>
                    <th class="number">Quantité</th>
                    <th class="center">Unité</th>
                    <th class="number">Prix unitaire HT</th>
                    <th class="number">Coût total HT</th>
                </tr>
            </thead>
            <tbody>
                ${(recipe.ingredients || []).map(item => `
                    <tr>
                        <td>${escapeHTML(item.name)}</td>
                        <td class="number">${escapeHTML(formatQuantity(item.quantity, item.unit))}</td>
                        <td class="center">${escapeHTML(item.unit)}</td>
                        <td class="number">${escapeHTML(formatUnitPrice(item.unitPrice))}</td>
                        <td class="number">${escapeHTML(formatCurrency(item.totalCost))}</td>
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr>
                    <th>Total recette (${portions} portion${portions > 1 ? 's' : ''})</th>
                    <th class="number">${escapeHTML(totalWeightNum)}</th>
                    <th class="center">${escapeHTML(totalWeightUnit)}</th>
                    <th class="number">—</th>
                    <th class="number">${escapeHTML(formatCurrency(recipe.totalCost))}</th>
                </tr>
                <tr class="portion-row">
                    <td>Par portion (1 portion)</td>
                    <td class="number">${escapeHTML(portionWeightNum)}</td>
                    <td class="center">${escapeHTML(portionWeightUnit)}</td>
                    <td class="number">—</td>
                    <td class="number">${escapeHTML(formatCurrency(recipe.costPerPortion))}</td>
                </tr>
            </tfoot>
        </table>
    `;
}

export function buildRecipePrintDocument(recipe) {
    const portions = recipe.portions || 0;
    return `<article class="bon-print-sheet">
        ${printDocumentHeader(
            `Détail de la recette : ${recipe.name}`,
            `Portions choisies : ${portions} — Liste des ingrédients nécessaires, poids et coût de revient HT.`
        )}
        <h2>${escapeHTML(recipe.name)} — ${portions} portion${portions > 1 ? 's' : ''}</h2>
        ${buildRecipePrintTable(recipe)}
        ${buildWeightFootnoteHTML(recipe.excludedWeightNames, recipe.volumeApproxUsed)}
    </article>`;
}

export function buildGlobalPrintDocument(bonData, summaryOnly) {
    const recipesHTML = summaryOnly ? '' : (bonData.detailed || []).map(recipe => {
        const portions = recipe.portions || 0;
        return `
            <section class="bon-print-section">
                <h2>${escapeHTML(recipe.name)} — ${portions} portion${portions > 1 ? 's' : ''}</h2>
                ${buildRecipePrintTable(recipe)}
                ${buildWeightFootnoteHTML(recipe.excludedWeightNames, recipe.volumeApproxUsed)}
            </section>
        `;
    }).join('');

    return `<article class="bon-print-sheet">
        ${printDocumentHeader(
            summaryOnly ? 'Récapitulatif global des denrées' : 'Récapitulatif complet',
            summaryOnly
                ? 'Synthèse des recettes sélectionnées et liste consolidée des ingrédients à prélever ou commander.'
                : 'Synthèse des recettes, récapitulatif global des denrées et détail recette par recette.'
        )}
        <h2>Synthèse des recettes sélectionnées</h2>
        ${buildRecipesSummaryPrintTable(bonData)}
        <h2>Récapitulatif global des denrées (Économat)</h2>
        ${buildSummaryPrintTable(bonData)}
        ${buildWeightFootnoteHTML(bonData.summaryExcludedWeightNames, bonData.globalVolumeApproxUsed)}
        ${recipesHTML}
    </article>`;
}

function exportToCSV() {
    const bonData = getBonData();
    if (!bonData || (!bonData.summary?.length && !bonData.detailed?.length)) {
        showToast('Aucune donnée à exporter.', 'warning');
        return;
    }
    const csvContent = buildGlobalCSVContent(bonData);
    downloadTextFile('\uFEFF' + csvContent, `bon_economat_${Date.now()}.csv`, 'text/csv;charset=utf-8');
}

function exportToTXT() {
    const bonData = getBonData();
    if (!bonData || (!bonData.summary?.length && !bonData.detailed?.length)) {
        showToast('Aucune donnée à exporter.', 'warning');
        return;
    }
    const content = buildGlobalTXTContent(bonData);
    downloadTextFile(content, `bon_economat_${Date.now()}.txt`, 'text/tab-separated-values;charset=utf-8');
}

function exportToFixedTXT() {
    const bonData = getBonData();
    if (!bonData || (!bonData.summary?.length && !bonData.detailed?.length)) {
        showToast('Aucune donnée à exporter.', 'warning');
        return;
    }
    const content = buildGlobalFixedTXTContent(bonData);
    downloadTextFile(content, `bon_economat_${Date.now()}_fixed.txt`, 'text/plain;charset=utf-8');
}
