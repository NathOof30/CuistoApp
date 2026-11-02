import { mercuriale, recipes, VAT_RATE, getIngredientById, calculateRecipeCost, saveData } from '../data.js';
import { formatCurrency, formatCurrency3, formatUnitPrice, formatQuantity, formatQuantityPlain, escapeHTML, convertUnitQuantity } from './common.js';
import { showToast } from './ui-feedback.js';

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

function addRecipeSelector() {
    const container = document.getElementById('recipe-selection-area');
    const selectorId = `recipe-selector-${container.children.length}`;

    const selectorHTML = `
        <div class="recipe-selector-row" id="${selectorId}">
            <div class="selector-field selector-field-main">
                <label class="field-label">Recette à confectionner</label>
                <select class="recipe-select">
                    <option value="">Choisir une recette dans la mercuriale...</option>
                    ${[...recipes].sort((a, b) => a.name.localeCompare(b.name)).map(r => `<option value="${r.id}">${escapeHTML(r.name)} (${r.servings || 1} portion${(r.servings || 1) > 1 ? 's' : ''})</option>`).join('')}
                </select>
            </div>
            <div class="selector-field selector-field-qty">
                <label class="field-label">Nombre de portions (N)</label>
                <input type="number" class="portions-input" placeholder="Ex: 1" min="1" value="1">
            </div>
            <div class="selector-field selector-field-btn">
                <button type="button" class="delete-selector-btn button-danger-subtle" title="Supprimer cette ligne">🗑️</button>
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

function processRecipeItems(items, portionMultiplier, recipeDetails, summary, visited = new Set()) {
    items.forEach(item => {
        if (item.isSubRecipe || item.type === 'subrecipe' || item.subRecipeId) {
            const subId = parseInt(item.subRecipeId || item.ingredientId);
            if (visited.has(subId)) return;
            const newVisited = new Set(visited);
            newVisited.add(subId);

            const subRecipe = recipes.find(r => r.id === subId);
            if (subRecipe && subRecipe.servings) {
                const subPortionMultiplier = (item.quantity * portionMultiplier) / subRecipe.servings;
                processRecipeItems(subRecipe.ingredients || [], subPortionMultiplier, recipeDetails, summary, newVisited);
            }
        } else if (item.ingredientId) {
            const ingredient = getIngredientById(item.ingredientId);
            if (!ingredient) return;

            const ingUnit = ingredient.unit;
            const recipeUnit = item.unit || ingUnit;

            const requiredInRecipeUnit = item.quantity * portionMultiplier;
            const requiredInBaseUnit = convertUnitQuantity(requiredInRecipeUnit, recipeUnit, ingUnit);

            const yieldPct = (typeof ingredient.yield === 'number' && ingredient.yield > 0) ? ingredient.yield : 100;
            const effectivePrice = (ingredient.price || 0) / (yieldPct / 100);
            const cost = effectivePrice * requiredInBaseUnit;

            recipeDetails.ingredients.push({
                name: ingredient.name,
                quantity: requiredInBaseUnit,
                unit: ingUnit,
                unitPrice: effectivePrice,
                totalCost: cost
            });
            recipeDetails.totalCost += cost;

            if (summary.has(ingredient.id)) {
                const existing = summary.get(ingredient.id);
                existing.quantity += requiredInBaseUnit;
                existing.totalCost += cost;
            } else {
                summary.set(ingredient.id, {
                    id: ingredient.id,
                    name: ingredient.name,
                    quantity: requiredInBaseUnit,
                    unit: ingUnit,
                    totalCost: cost,
                    family: ingredient.family
                });
            }
        }
    });
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

        processRecipeItems(recipe.ingredients || [], portionMultiplier, recipeDetails, summary);

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

    detailedContainer.innerHTML = '<h3 class="section-title">📖 Détail par Recette</h3>';
    detailed.forEach((recipe, recipeIndex) => {
        let tableHTML = `
            <div class="card bon-recipe-card" id="recipe-breakdown-${recipeIndex}">
                <div class="recipe-card-header">
                    <h4 class="recipe-card-title">🍽️ ${escapeHTML(recipe.name)}</h4>
                    <span class="badge-recipe-cost">Coût Recette : ${formatCurrency(recipe.totalCost)}</span>
                </div>
                <div class="export-actions recipe-export-actions">
                    <button type="button" class="button-secondary btn-with-icon" data-export-format="csv" data-recipe-index="${recipeIndex}"><span>📊</span> CSV</button>
                    <button type="button" class="button-secondary btn-with-icon" data-export-format="txt" data-recipe-index="${recipeIndex}"><span>📄</span> TXT Tabulé</button>
                    <button type="button" class="button-secondary btn-with-icon" data-export-format="fixed-txt" data-recipe-index="${recipeIndex}"><span>📝</span> TXT Colonnes</button>
                    <button type="button" class="button-secondary btn-with-icon" data-export-format="pdf" data-recipe-index="${recipeIndex}"><span>📄</span> PDF</button>
                </div>
                <div class="table-container">
                    <table class="bon-table">
                        <thead>
                            <tr>
                                <th style="width: 40%;">Intitulé ingrédient</th>
                                <th style="width: 20%; text-align: right;">Quantité</th>
                                <th style="width: 15%; text-align: center;">Unité</th>
                                <th style="width: 20%; text-align: right;">Prix unitaire HT</th>
                                <th style="width: 20%; text-align: right;">Coût total HT</th>
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
                                <td colspan="4" style="text-align:right; font-weight:bold;">Coût Ingrédients Total Recette :</td>
                                <td style="text-align:right; font-weight:800;" class="tabular-price-bold">${formatCurrency(recipe.totalCost)}</td>
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
                <td data-label="Denrée"><strong>${escapeHTML(item.name)}</strong></td>
                <td data-label="Quantité" style="text-align: right;"><span class="badge-qty">${formatQuantity(item.quantity, item.unit)}</span></td>
                <td data-label="Unité" style="text-align: center;"><span class="badge-unit">${escapeHTML(item.unit)}</span></td>
                <td data-label="Coût HT" style="text-align: right;" class="tabular-price-bold">${formatCurrency(item.totalCost)}</td>
            </tr>
        `;
        summaryTbody.insertAdjacentHTML('beforeend', row);
    });

    // Mettre à jour les totaux globaux et le devis
    const quoteIngredientsCost = document.getElementById('quote-ingredients-cost');
    if (quoteIngredientsCost) quoteIngredientsCost.textContent = formatCurrency(globalTotalCost);

    document.getElementById('global-total-cost').textContent = formatCurrency(globalTotalCost);

    document.getElementById('total-sale-price-ht').textContent = formatCurrency(totalSalePriceHT);
    document.getElementById('total-sale-price-ttc').textContent = formatCurrency(totalSalePriceTTC);

    const grossMargin = totalSalePriceHT - globalTotalCost;
    const marginPercent = totalSalePriceHT > 0 ? ((grossMargin / totalSalePriceHT) * 100).toFixed(1) : 0;

    const grossMarginElem = document.getElementById('total-gross-margin');
    if (grossMarginElem) {
        grossMarginElem.innerHTML = `${formatCurrency(grossMargin)} <small class="margin-percent-pill">(${marginPercent}%)</small>`;
    }

    const resultsCountBadge = document.getElementById('results-count-badge');
    if (resultsCountBadge) {
        resultsCountBadge.textContent = `${summary.length} denrée${summary.length > 1 ? 's' : ''} • ${detailed.length} recette${detailed.length > 1 ? 's' : ''}`;
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

function exportRecipe(recipeIndex, format) {
    const bonData = getBonData();
    const recipe = bonData?.detailed?.[recipeIndex];
    if (!recipe) return;

    const rows = recipe.ingredients.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totalCost: item.totalCost
    }));
    const baseName = `bon_economat_${recipe.name.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')}_${Date.now()}`;

    if (format === 'csv') {
        const content = [
            'Intitulé ingrédient,Quantité,Unité,Prix unitaire HT,Coût total HT',
            ...rows.map(item => [
                `"${String(item.name).replace(/"/g, '""')}"`,
                formatQuantityPlain(item.quantity, item.unit),
                item.unit,
                Number(item.unitPrice || 0).toFixed(2),
                Number(item.totalCost || 0).toFixed(2)
            ].join(',')),
            `Total recette,,,,${Number(recipe.totalCost || 0).toFixed(2)}`
        ].join('\r\n');
        downloadTextFile(content, `${baseName}.csv`, 'text/csv;charset=utf-8');
    } else if (format === 'txt') {
        const content = [
            ['Intitulé ingrédient', 'Quantité', 'Unité', 'Prix unitaire HT', 'Coût total HT'].join('\t'),
            ...rows.map(item => [
                String(item.name).replace(/[\t\n\r]/g, ' ').trim(),
                formatQuantityPlain(item.quantity, item.unit),
                String(item.unit).replace(/[\t\n\r]/g, ' ').trim(),
                Number(item.unitPrice || 0).toFixed(2),
                Number(item.totalCost || 0).toFixed(2)
            ].join('\t')),
            ['Total recette', '', '', '', Number(recipe.totalCost || 0).toFixed(2)].join('\t')
        ].join('\r\n');
        downloadTextFile(content, `${baseName}.txt`, 'text/tab-separated-values;charset=utf-8');
    } else if (format === 'fixed-txt') {
        const nameWidth = Math.max(20, Math.min(40, Math.max('Intitulé ingrédient'.length, ...rows.map(item => String(item.name).length))));
        const widths = [nameWidth, 14, 8, 18, 14];
        const padEnd = (value, width) => String(value).padEnd(width, ' ');
        const padStart = (value, width) => String(value).padStart(width, ' ');
        const formatRow = (item) => [
            padEnd(String(item.name).slice(0, widths[0]), widths[0]),
            padStart(formatQuantityPlain(item.quantity, item.unit), widths[1]),
            padEnd(String(item.unit).slice(0, widths[2]), widths[2]),
            padStart(Number(item.unitPrice || 0).toFixed(2), widths[3]),
            padStart(Number(item.totalCost || 0).toFixed(2), widths[4])
        ].join('  ');
        const header = [
            padEnd('Intitulé ingrédient', widths[0]),
            padStart('Quantité', widths[1]),
            padEnd('Unité', widths[2]),
            padStart('Prix unitaire HT', widths[3]),
            padStart('Coût total HT', widths[4])
        ].join('  ');
        const separator = widths.map(width => ''.padEnd(width, '-')).join('  ');
        const total = [
            padEnd('Total recette', widths[0]),
            padEnd('', widths[1]),
            padEnd('', widths[2]),
            padEnd('', widths[3]),
            padStart(Number(recipe.totalCost || 0).toFixed(2), widths[4])
        ].join('  ');
        downloadTextFile([header, separator, ...rows.map(formatRow), separator, total].join('\r\n'), `${baseName}_fixed.txt`, 'text/plain;charset=utf-8');
    }
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

    const printStyles = `
        @page { size: A4 portrait; margin: 12mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #111827; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 9pt; }
        .bon-print-sheet { width: 100%; }
        .bon-print-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 8pt; margin-bottom: 8pt; }
        .bon-print-header h1 { font-size: 17pt; margin: 0 0 3pt; }
        .bon-print-header p, .bon-print-subtitle { margin: 0; color: #4b5563; }
        .bon-print-meta { text-align: right; font-size: 8pt; }
        .bon-print-meta span { display: block; color: #4b5563; }
        .bon-print-sheet h2 { font-size: 12pt; margin: 14pt 0 6pt; page-break-after: avoid; }
        .bon-print-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0 0 8pt; }
        .bon-print-table th, .bon-print-table td { border: 1px solid #9ca3af; padding: 5pt 6pt; text-align: left; vertical-align: middle; overflow-wrap: anywhere; }
        .bon-print-table th { background: #f3f4f6; font-weight: 700; }
        .bon-print-table .number { text-align: right; }
        .bon-print-table tfoot th { background: #f9fafb; }
        .bon-print-total { display: flex; justify-content: space-between; border-top: 2px solid #111827; border-bottom: 1px solid #9ca3af; padding: 7pt 0; margin: 8pt 0 16pt; }
        .bon-print-section { page-break-inside: avoid; margin-top: 14pt; }
    `;

    printFrame.onload = () => {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.onafterprint = cleanup;
        printFrame.contentWindow.print();
    };

    const printDocument = printFrame.contentDocument;
    printDocument.open();
    printDocument.write(`<!doctype html><html lang="fr"><head><meta charset="UTF-8"><title>Bon d'économat</title><style>${printStyles}</style></head><body>${documentHTML}</body></html>`);
    printDocument.close();

    const cleanup = () => {
        window.removeEventListener('afterprint', cleanup);
        printFrame.remove();
    };
    window.addEventListener('afterprint', cleanup);
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

function buildSummaryPrintTable(summary) {
    return `
        <table class="bon-print-table">
            <thead>
                <tr><th>Nom de la denrée</th><th class="number">Quantité totale</th><th>Unité</th><th class="number">Coût total HT</th></tr>
            </thead>
            <tbody>
                ${[...summary].sort((a, b) => a.name.localeCompare(b.name)).map(item => `
                    <tr>
                        <td>${escapeHTML(item.name)}</td>
                        <td class="number">${escapeHTML(formatQuantity(item.quantity, item.unit))}</td>
                        <td>${escapeHTML(item.unit)}</td>
                        <td class="number">${formatCurrency(item.totalCost)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function buildRecipePrintTable(recipe) {
    return `
        <table class="bon-print-table">
            <thead>
                <tr><th>Intitulé ingrédient</th><th class="number">Quantité</th><th>Unité</th><th class="number">Prix unitaire HT</th><th class="number">Coût total HT</th></tr>
            </thead>
            <tbody>
                ${recipe.ingredients.map(item => `
                    <tr>
                        <td>${escapeHTML(item.name)}</td>
                        <td class="number">${escapeHTML(formatQuantity(item.quantity, item.unit))}</td>
                        <td>${escapeHTML(item.unit)}</td>
                        <td class="number">${formatUnitPrice(item.unitPrice)}</td>
                        <td class="number">${formatCurrency(item.totalCost)}</td>
                    </tr>
                `).join('')}
            </tbody>
            <tfoot><tr><th colspan="4">Coût ingrédients total recette</th><th class="number">${formatCurrency(recipe.totalCost)}</th></tr></tfoot>
        </table>
    `;
}

function buildRecipePrintDocument(recipe) {
    return `<article class="bon-print-sheet">
        ${printDocumentHeader(`Détail de la recette : ${recipe.name}`, 'Liste des ingrédients nécessaires et coût de revient HT.')}
        <h2>${escapeHTML(recipe.name)}</h2>
        ${buildRecipePrintTable(recipe)}
    </article>`;
}

function buildGlobalPrintDocument(bonData, summaryOnly) {
    const recipesHTML = summaryOnly ? '' : bonData.detailed.map(recipe => `
        <section class="bon-print-section">
            <h2>${escapeHTML(recipe.name)}</h2>
            ${buildRecipePrintTable(recipe)}
        </section>
    `).join('');
    return `<article class="bon-print-sheet">
        ${printDocumentHeader(
            summaryOnly ? 'Récapitulatif global des denrées' : 'Récapitulatif complet',
            summaryOnly ? 'Liste consolidée des ingrédients à prélever ou commander.' : 'Synthèse des denrées et détail des recettes sélectionnées.'
        )}
        <h2>Récapitulatif Global des Denrées (Économat)</h2>
        ${buildSummaryPrintTable(bonData.summary)}
        <p class="bon-print-total"><strong>Coût total des denrées (HT)</strong><strong>${formatCurrency(bonData.globalTotalCost)}</strong></p>
        ${recipesHTML}
    </article>`;
}


function exportToCSV() {
    const bonDataString = document.getElementById('bon-economat-results').dataset.bonData;
    if (!bonDataString) {
        showToast("Veuillez d'abord générer un bon d'économat.", 'warning');
        return;
    }
    const bonData = JSON.parse(bonDataString);

    if (bonData.summary.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Nom de la denrée,Quantité totale,Unité,Coût total HT\r\n";

    bonData.summary.sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
        const row = [
            `"${item.name.replace(/"/g, '""')}"`,
            formatQuantityPlain(item.quantity, item.unit),
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
        showToast("Veuillez d'abord générer un bon d'économat.", 'warning');
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
                formatQuantityPlain(item.quantity, item.unit),
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
        showToast("Veuillez d'abord générer un bon d'économat.", 'warning');
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
            padStart(formatQuantityPlain(i.quantity, i.unit), qtyColWidth),
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