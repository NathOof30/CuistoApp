import { mercuriale, recipes, VAT_RATE, getIngredientById, calculateRecipeCost, saveData } from '../data.js';
import { formatCurrency, formatQuantity, escapeHTML } from './common.js';

// Utiliser directement les exports pour éviter l'état obsolète

export function initBonEconomatPage() {
    const addRecipeBtn = document.getElementById('add-recipe-selector-btn');
    const generateBtn = document.getElementById('generate-btn');

    addRecipeSelector(); // Add the first selector
    addRecipeBtn.addEventListener('click', addRecipeSelector);
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
}

function addRecipeSelector() {
    const container = document.getElementById('recipe-selection-area');
    const selectorId = `recipe-selector-${container.children.length}`;

    const selectorHTML = `
        <div class="recipe-selector-row" id="${selectorId}">
            <select class="recipe-select">
                <option value="">Choisir une recette...</option>
                ${[...recipes].sort((a, b) => a.name.localeCompare(b.name)).map(r => `<option value="${r.id}">${escapeHTML(r.name)}</option>`).join('')}
            </select>
            <input type="number" class="portions-input" placeholder="Nb. portions" min="1">
            <button type="button" class="delete-selector-btn button-secondary">🗑️</button>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', selectorHTML);

    const newSelector = document.getElementById(selectorId);
    newSelector.querySelector('.delete-selector-btn').addEventListener('click', () => {
        newSelector.remove();
    });
}

function generateBonEconomat() {
    const selections = getSelectionsFromUI();

    if (selections.length === 0) {
        alert("Veuillez sélectionner au moins une recette et indiquer le nombre de portions.");
        return;
    }

    const bonData = calculateBonData(selections);
    // Store bon data for export
    document.getElementById('bon-economat-results').dataset.bonData = JSON.stringify(bonData);
    renderBonEconomat(bonData);
}

function getSelectionsFromUI() {
    const selections = [];
    document.querySelectorAll('.recipe-selector-row').forEach(row => {
        const recipeId = row.querySelector('.recipe-select').value;
        const portions = parseInt(row.querySelector('.portions-input').value);
        if (recipeId && portions > 0) {
            selections.push({ recipeId: parseInt(recipeId), portions });
        }
    });
    return selections;
}

function calculateBonData(selections) {
    const detailed = [];
    const summary = new Map();
    let globalTotalCost = 0;
    let totalSalePriceHT = 0;
    let totalSalePriceTTC = 0;

    selections.forEach(({ recipeId, portions }) => {
        const recipe = recipes.find(r => r.id === recipeId);
        if (!recipe || !recipe.servings) return;

        const portionMultiplier = portions / recipe.servings;
        const recipeDetails = {
            name: recipe.name,
            ingredients: [],
            totalCost: 0
        };

        recipe.ingredients.forEach(item => {
            const ingredient = getIngredientById(item.ingredientId);
            if (!ingredient) return;

            const requiredQuantity = item.quantity * portionMultiplier;
            const cost = (ingredient.price || 0) * requiredQuantity;

            recipeDetails.ingredients.push({
                name: ingredient.name,
                quantity: requiredQuantity,
                unit: ingredient.unit,
                unitPrice: ingredient.price || 0,
                totalCost: cost
            });
            recipeDetails.totalCost += cost;

            // Update summary
            if (summary.has(ingredient.id)) {
                const existing = summary.get(ingredient.id);
                existing.quantity += requiredQuantity;
                existing.totalCost += cost;
            } else {
                summary.set(ingredient.id, {
                    id: ingredient.id,
                    name: ingredient.name,
                    quantity: requiredQuantity,
                    unit: ingredient.unit,
                    totalCost: cost,
                    family: ingredient.family
                });
            }
        });

        // Calcul du prix de vente pour cette recette
        const recipeTotalCost = calculateRecipeCost(recipe);
        const costPerServing = recipe.servings > 0 ? recipeTotalCost / recipe.servings : 0;
        const salePriceHTPerServing = costPerServing * (recipe.multiplier || 0);
        const salePriceTTCPerServing = salePriceHTPerServing * (1 + VAT_RATE);

        // Prix de vente pour les portions demandées
        totalSalePriceHT += salePriceHTPerServing * portions;
        totalSalePriceTTC += salePriceTTCPerServing * portions;

        detailed.push(recipeDetails);
        globalTotalCost += recipeDetails.totalCost;
    });

    return {
        detailed,
        summary: Array.from(summary.values()),
        globalTotalCost,
        totalSalePriceHT,
        totalSalePriceTTC
    };
}

function renderBonEconomat({ detailed, summary, globalTotalCost, totalSalePriceHT, totalSalePriceTTC }) {
    const detailedContainer = document.getElementById('detailed-breakdown');
    const summaryTbody = document.querySelector('#summary-table tbody');

    detailedContainer.innerHTML = '<h3>Détail par recette</h3>';
    detailed.forEach(recipe => {
        let tableHTML = `
            <div class="card bon-recipe-card">
                <h4>${escapeHTML(recipe.name)}</h4>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Intitulé</th>
                                <th>Quantité</th>
                                <th>Unité</th>
                                <th>Prix unitaire HT</th>
                                <th>Coût total HT</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        recipe.ingredients.forEach(ing => {
            tableHTML += `
                <tr>
                    <td>${escapeHTML(ing.name)}</td>
                    <td>${formatQuantity(ing.quantity, ing.unit)}</td>
                    <td>${escapeHTML(ing.unit)}</td>
                    <td>${formatCurrency(ing.unitPrice)}</td>
                    <td>${formatCurrency(ing.totalCost)}</td>
                </tr>
            `;
        });
        tableHTML += `
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="4" style="text-align:right; font-weight:bold;">Total Recette:</td>
                                <td style="font-weight:bold;">${formatCurrency(recipe.totalCost)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
        detailedContainer.insertAdjacentHTML('beforeend', tableHTML);
    });

    summaryTbody.innerHTML = '';
    summary.sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
        const row = `
            <tr>
                <td>${escapeHTML(item.name)}</td>
                <td>${formatQuantity(item.quantity, item.unit)}</td>
                <td>${escapeHTML(item.unit)}</td>
                <td>${formatCurrency(item.totalCost)}</td>
            </tr>
        `;
        summaryTbody.insertAdjacentHTML('beforeend', row);
    });

    document.getElementById('global-total-cost').textContent = formatCurrency(globalTotalCost);

    // Afficher le devis de vente
    document.getElementById('total-sale-price-ht').textContent = formatCurrency(totalSalePriceHT);
    document.getElementById('total-sale-price-ttc').textContent = formatCurrency(totalSalePriceTTC);
    document.getElementById('total-gross-margin').textContent = formatCurrency(totalSalePriceHT - globalTotalCost);

    document.getElementById('bon-economat-results').classList.remove('hidden');
}


function exportToCSV() {
    const bonDataString = document.getElementById('bon-economat-results').dataset.bonData;
    if (!bonDataString) {
        alert("Veuillez d'abord générer un bon d'économat.");
        return;
    }
    const bonData = JSON.parse(bonDataString);

    if (bonData.summary.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Nom de la denrée,Quantité totale,Unité,Coût total HT\r\n";

    bonData.summary.sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
        const row = [
            `"${item.name.replace(/"/g, '""')}"`,
            item.quantity.toFixed(3),
            item.unit,
            item.totalCost.toFixed(2)
        ].join(',');
        csvContent += row + "\r\n";
    });

    csvContent += `\r\nTotal Global,,,"${bonData.globalTotalCost.toFixed(2)}"`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bon_economat_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportToTXT() {
    const bonDataString = document.getElementById('bon-economat-results').dataset.bonData;
    if (!bonDataString) {
        alert("Veuillez d'abord générer un bon d'économat.");
        return;
    }
    const bonData = JSON.parse(bonDataString);

    if (bonData.summary.length === 0) return;

    // Format tabulé (TSV) avec tabulations \t entre colonnes pour alignement dans les éditeurs
    const lines = [];
    lines.push(['Nom de la denrée', 'Quantité totale', 'Unité', 'Coût total HT'].join('\t'));
    bonData.summary
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(item => {
            const cols = [
                String(item.name || '').replace(/[\t\n\r]/g, ' ').trim(),
                Number(item.quantity || 0).toFixed(3),
                String(item.unit || '').replace(/[\t\n\r]/g, ' ').trim(),
                Number(item.totalCost || 0).toFixed(2)
            ];
            lines.push(cols.join('\t'));
        });
    lines.push(['Total Global', '', '', Number(bonData.globalTotalCost || 0).toFixed(2)].join('\t'));

    const blob = new Blob([lines.join("\r\n")], { type: 'text/tab-separated-values;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bon_economat_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function exportToFixedTXT() {
    const bonDataString = document.getElementById('bon-economat-results').dataset.bonData;
    if (!bonDataString) {
        alert("Veuillez d'abord générer un bon d'économat.");
        return;
    }
    const bonData = JSON.parse(bonDataString);
    if (!bonData.summary || bonData.summary.length === 0) return;

    const sanitized = bonData.summary.map(i => ({
        name: String(i.name || '').replace(/[\t\n\r]/g, ' ').trim(),
        quantity: Number(i.quantity || 0),
        unit: String(i.unit || '').replace(/[\t\n\r]/g, ' ').trim(),
        totalCost: Number(i.totalCost || 0)
    }));

    const nameHeader = 'Nom de la denrée';
    const qtyHeader = 'Quantité totale';
    const unitHeader = 'Unité';
    const costHeader = 'Coût total HT';

    const maxNameLen = Math.max(nameHeader.length, ...sanitized.map(i => i.name.length));
    const nameColWidth = Math.max(20, Math.min(40, maxNameLen));
    const qtyColWidth = Math.max(qtyHeader.length, 14);
    const unitColWidth = Math.max(unitHeader.length, 8);
    const costColWidth = Math.max(costHeader.length, 14);

    const trunc = (text, width) => (text.length <= width ? text : text.slice(0, width - 1) + '…');
    const padEnd = (text, width) => `${text}`.padEnd(width, ' ');
    const padStart = (text, width) => `${text}`.padStart(width, ' ');

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
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(i => [
            padEnd(trunc(i.name, nameColWidth), nameColWidth),
            padStart(i.quantity.toFixed(3), qtyColWidth),
            padEnd(trunc(i.unit, unitColWidth), unitColWidth),
            padStart(i.totalCost.toFixed(2), costColWidth)
        ].join('  '));

    const totalLine = [
        padEnd(trunc('Total Global', nameColWidth), nameColWidth),
        padEnd('', qtyColWidth),
        padEnd('', unitColWidth),
        padStart(bonData.globalTotalCost.toFixed(2), costColWidth)
    ].join('  ');

    const content = [header, sep, ...rows, sep, totalLine].join('\r\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bon_economat_${Date.now()}_fixed.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}