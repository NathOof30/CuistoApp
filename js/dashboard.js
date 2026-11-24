import {
    mercuriale, recipes, calculateRecipeCost, calculateNetMargin,
    calculateActualPriceHTPerServing, calculateSuggestedPrice,
    applyGlobalSettings,
    VAT_RATE, CHARGED_HOURLY_RATE, OVERHEAD_RATE, TARGET_NET_MARGIN
} from '../data.js';
import { formatCurrency, escapeHTML, formatPercent, formatRate } from './common.js';
import { showToast } from './ui-feedback.js';

export function initDashboard() {
    displayStats();
    renderTopRecipes();
    displayNotifications();
    initSettingsForm();

    const addDenreeBtn = document.querySelector('a.action-button[href="mercuriale.html?action=add"]');
    if (addDenreeBtn) {
        addDenreeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.setItem('openIngredientModal', 'true');
            window.location.href = 'mercuriale.html';
        });
    }

    const addRecipeBtn = document.querySelector('a.action-button[href="recettes.html?action=add"]');
    if (addRecipeBtn) {
        addRecipeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.setItem('openRecipeModal', 'true');
            window.location.href = 'recettes.html';
        });
    }
}

export function refreshDashboard() {
    syncSettingsFormValues();
    displayStats();
    renderTopRecipes();
    displayNotifications();
}

function syncSettingsFormValues() {
    const hourlyRateInput = document.getElementById('settings-hourly-rate');
    const overheadInput = document.getElementById('settings-overhead');
    const targetMarginInput = document.getElementById('settings-target-margin');
    const vatInput = document.getElementById('settings-vat');

    if (hourlyRateInput) hourlyRateInput.value = CHARGED_HOURLY_RATE.toFixed(2);
    if (overheadInput) overheadInput.value = parseFloat((OVERHEAD_RATE * 100).toFixed(2));
    if (targetMarginInput) targetMarginInput.value = parseFloat((TARGET_NET_MARGIN * 100).toFixed(2));
    if (vatInput) vatInput.value = parseFloat((VAT_RATE * 100).toFixed(2));
}

function initSettingsForm() {
    const form = document.getElementById('global-settings-form');
    if (!form) return;

    const hourlyRateInput = document.getElementById('settings-hourly-rate');
    const overheadInput = document.getElementById('settings-overhead');
    const targetMarginInput = document.getElementById('settings-target-margin');
    const vatInput = document.getElementById('settings-vat');

    syncSettingsFormValues();

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const hr = parseFloat(hourlyRateInput.value);
        const oh = parseFloat(overheadInput.value);
        const margin = parseFloat(targetMarginInput.value);
        const vat = parseFloat(vatInput.value);

        if (!Number.isFinite(hr) || hr < 0 || !Number.isFinite(oh) || oh < 0 || oh > 100 || !Number.isFinite(vat) || vat < 0 || vat > 100) {
            showToast('Veuillez saisir des valeurs valides.', 'error');
            return;
        }
        if (!Number.isFinite(margin) || margin < 0 || margin >= 100) {
            showToast('La marge nette cible doit être comprise entre 0 % et 99 %.', 'error');
            return;
        }

        // Sauvegarder de façon sécurisée et mettre à jour les live bindings de data.js
        const saved = applyGlobalSettings({
            chargedHourlyRate: hr,
            overheadRate: oh,
            targetNetMargin: margin,
            vatRate: vat
        });
        if (!saved) {
            showToast('Impossible de sauvegarder les paramètres (stockage local saturé).', 'error');
            return;
        }

        // Rafraîchir l'affichage du dashboard
        displayStats();
        renderTopRecipes();
        displayNotifications();

        showToast('Paramètres de simulation enregistrés et appliqués.', 'success', 2000);
    });
}

function displayStats() {
    const totalRecipesEl = document.getElementById('kpi-total-recipes');
    const totalSubEl = document.getElementById('kpi-total-sub');
    const profitableEl = document.getElementById('kpi-profitable-recipes');
    const profitableSubEl = document.getElementById('kpi-profitable-sub');
    const deficitEl = document.getElementById('kpi-deficit-recipes');
    const deficitCardEl = document.getElementById('kpi-deficit-card');
    const avgMarginEl = document.getElementById('kpi-avg-margin');
    const marginSubEl = document.getElementById('kpi-margin-sub');

    const totalRecipes = recipes.length;
    const totalIngredients = mercuriale.length;

    // Analyse par recette avec MO
    const recipesWithTime = recipes.filter(r => r.productionTime && r.productionTime > 0);
    const targetPercent = TARGET_NET_MARGIN * 100;
    const mediumThreshold = targetPercent * 0.5;

    let profitableCount = 0;
    let deficitCount = 0;
    let sumMargins = 0;

    recipesWithTime.forEach(r => {
        const netMargin = calculateNetMargin(r);
        if (netMargin >= targetPercent) {
            profitableCount++;
        } else if (netMargin < 0) {
            deficitCount++;
        }
        sumMargins += netMargin;
    });

    const avgMargin = recipesWithTime.length > 0 ? (sumMargins / recipesWithTime.length) : null;

    if (totalRecipesEl) totalRecipesEl.textContent = totalRecipes;
    if (totalSubEl) totalSubEl.textContent = `${totalIngredients} denrée${totalIngredients > 1 ? 's' : ''} en mercuriale`;

    if (profitableEl) profitableEl.textContent = profitableCount;
    if (profitableSubEl) {
        profitableSubEl.textContent = recipesWithTime.length > 0
            ? `${profitableCount} sur ${recipesWithTime.length} (cible ≥ ${formatRate(targetPercent)})`
            : `Cible : ${formatRate(targetPercent)}`;
    }

    if (deficitEl) deficitEl.textContent = deficitCount;
    if (deficitCardEl) {
        deficitCardEl.className = deficitCount > 0
            ? 'db-kpi-card db-kpi-danger'
            : (recipesWithTime.length > 0 ? 'db-kpi-card db-kpi-success' : 'db-kpi-card db-kpi-neutral');
    }

    if (avgMarginEl) {
        avgMarginEl.textContent = avgMargin !== null ? formatPercent(avgMargin) : 'N/A';
        avgMarginEl.style.color = avgMargin !== null
            ? (avgMargin >= targetPercent ? 'var(--margin-high)' : (avgMargin >= mediumThreshold ? 'var(--margin-medium)' : 'var(--margin-low)'))
            : 'var(--text-color)';
    }
    if (marginSubEl) {
        marginSubEl.textContent = recipesWithTime.length > 0
            ? `${recipesWithTime.length} recette${recipesWithTime.length > 1 ? 's' : ''} analysée${recipesWithTime.length > 1 ? 's' : ''}`
            : 'Temps de prod. non renseigné';
    }
}

function renderTopRecipes() {
    const container = document.getElementById('top-recipes-content');
    if (!container) return;

    if (recipes.length === 0) {
        container.innerHTML = `
            <div class="db-empty-state">
                <p>Aucune recette enregistrée pour le moment.</p>
                <a href="recettes.html?action=add" class="button-primary" style="margin-top:0.75rem; display:inline-flex;">+ Créer une recette</a>
            </div>
        `;
        return;
    }

    const targetPercent = TARGET_NET_MARGIN * 100;
    const mediumThreshold = targetPercent * 0.5;

    // Calculer et classer les recettes
    const rankedRecipes = [...recipes].map(recipe => {
        const hasTime = recipe.productionTime && recipe.productionTime > 0;
        const netMargin = hasTime ? calculateNetMargin(recipe) : null;
        const totalCost = calculateRecipeCost(recipe);
        const costPerServing = recipe.servings > 0 ? totalCost / recipe.servings : 0;
        const pvHT = calculateActualPriceHTPerServing(recipe);
        const grossMargin = pvHT > 0 ? ((pvHT - costPerServing) / pvHT) * 100 : 0;
        return {
            recipe,
            hasTime,
            netMargin,
            pvHT,
            grossMargin
        };
    }).sort((a, b) => {
        // Priorité aux recettes avec MO renseignée, puis marge nette décroissante
        if (a.hasTime && !b.hasTime) return -1;
        if (!a.hasTime && b.hasTime) return 1;
        if (a.hasTime && b.hasTime) return b.netMargin - a.netMargin;
        return b.grossMargin - a.grossMargin;
    }).slice(0, 5);

    let rowsHtml = '';
    rankedRecipes.forEach((item, index) => {
        const r = item.recipe;
        const rank = index + 1;
        let marginBadge = '';

        if (item.hasTime) {
            const pillClass = item.netMargin >= targetPercent ? 'high' : (item.netMargin >= mediumThreshold ? 'medium' : 'low');
            marginBadge = `<span class="db-margin-pill ${pillClass}">${formatPercent(item.netMargin)}</span>`;
        } else {
            marginBadge = `<span class="db-margin-pill medium" title="Marge brute (temps de production non renseigné)">${formatPercent(item.grossMargin)} <small style="font-size:0.7rem;">(brute)</small></span>`;
        }

        rowsHtml += `
            <tr class="db-top-row" data-recipe-id="${r.id}" title="Cliquer pour voir la fiche technique complète">
                <td>
                    <div class="db-top-row-name">
                        <span class="db-rank-badge rank-${rank}">${rank}</span>
                        <span>${escapeHTML(r.name)}</span>
                        <span class="db-view-link">→</span>
                    </div>
                </td>
                <td class="font-mono" style="font-weight:600;">${formatCurrency(item.pvHT)}</td>
                <td>${marginBadge}</td>
            </tr>
        `;
    });

    container.innerHTML = `
        <table class="db-top-table">
            <thead>
                <tr>
                    <th>Recette</th>
                    <th>Prix Vente HT</th>
                    <th>Marge Nette</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>
    `;

    // Clic sur une ligne → redirection vers la fiche recette
    container.querySelectorAll('.db-top-row').forEach(row => {
        row.addEventListener('click', () => {
            const id = row.dataset.recipeId;
            if (id) {
                localStorage.setItem('openRecipeDetailsId', id);
                window.location.href = 'recettes.html';
            }
        });
    });
}

export function displayNotifications() {
    const alertsContainer = document.getElementById('alerts-content');
    if (!alertsContainer) return;
    alertsContainer.innerHTML = '';

    const alerts = [];

    // 1. Recettes déficitaires
    recipes.forEach(recipe => {
        if (recipe.productionTime && recipe.productionTime > 0) {
            const netMargin = calculateNetMargin(recipe);
            if (netMargin < 0) {
                const suggestedPrice = calculateSuggestedPrice(recipe);
                alerts.push({
                    type: 'critical',
                    label: 'Alerte',
                    html: `Recette <strong>${escapeHTML(recipe.name)}</strong> déficitaire (${formatPercent(netMargin)}). Prix conseillé : <strong>${formatCurrency(suggestedPrice.ht)} HT</strong>. <a href="recettes.html" class="db-alert-link" data-edit-id="${recipe.id}">Modifier</a>`
                });
            }
        }
    });

    // 2. Recettes sans temps de production
    recipes.forEach(recipe => {
        if (!recipe.productionTime || recipe.productionTime <= 0) {
            alerts.push({
                type: 'warning',
                label: 'Temps',
                html: `Temps de production non renseigné pour <strong>${escapeHTML(recipe.name)}</strong> (Prime Cost incomplet). <a href="recettes.html" class="db-alert-link" data-edit-id="${recipe.id}">Renseigner</a>`
            });
        }
    });

    // 3. Denrées sans prix en mercuriale
    const unpricedIngredients = mercuriale.filter(ing => ing.price === null || ing.price === undefined || ing.price === '');
    if (unpricedIngredients.length > 0) {
        const names = unpricedIngredients.slice(0, 3).map(i => escapeHTML(i.name)).join(', ');
        const extra = unpricedIngredients.length > 3 ? ` et ${unpricedIngredients.length - 3} autre(s)` : '';
        alerts.push({
            type: 'info',
            label: 'Prix',
            html: `${unpricedIngredients.length} denrée(s) sans prix : <strong>${names}${extra}</strong>. <a href="mercuriale.html">Mettre à jour la mercuriale</a>`
        });
    }

    // 4. Aucune alerte
    if (alerts.length === 0) {
        alertsContainer.innerHTML = `
            <div class="db-alert-item ok">
                <div class="db-alert-body">
                    <strong>Tout est optimal.</strong> Toutes vos fiches techniques sont complètes et rentables.
                </div>
            </div>
        `;
        return;
    }

    // Rendu des alertes
    alerts.forEach(alert => {
        const div = document.createElement('div');
        div.className = `db-alert-item ${alert.type}`;
        div.innerHTML = `
            <span class="db-alert-icon" aria-hidden="true">${alert.type === 'critical' ? '!' : (alert.type === 'warning' ? '•' : 'i')}</span>
            <div class="db-alert-body">${alert.html}</div>
        `;
        alertsContainer.appendChild(div);
    });

    // Écouteurs sur les liens de modification directe
    alertsContainer.querySelectorAll('.db-alert-link[data-edit-id]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const editId = link.dataset.editId;
            if (editId) {
                localStorage.setItem('openRecipeEditId', editId);
                window.location.href = 'recettes.html';
            }
        });
    });
}
