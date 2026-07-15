import { mercuriale, recipes, calculateRecipeCost, calculateNetMargin, calculateActualPriceHTPerServing, getIngredientById, updateGlobalSettings, VAT_RATE, CHARGED_HOURLY_RATE, OVERHEAD_RATE, TARGET_NET_MARGIN } from '../data.js';
import { formatCurrency, escapeHTML, formatPercent } from './common.js';
import { showToast } from './ui-feedback.js';

// Utiliser les exports directement pour éviter l'état obsolète

export function initDashboard() {
    displayStats();
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
            // This is a simplified way to communicate between pages without a complex router.
            // We set a flag and the recettes page will check for it.
            localStorage.setItem('openRecipeModal', 'true');
            window.location.href = 'recettes.html';
        });
    }
}

function initSettingsForm() {
    const form = document.getElementById('global-settings-form');
    if (!form) return;

    const hourlyRateInput = document.getElementById('settings-hourly-rate');
    const overheadInput = document.getElementById('settings-overhead');
    const targetMarginInput = document.getElementById('settings-target-margin');
    const vatInput = document.getElementById('settings-vat');

    // Pré-remplir avec les valeurs courantes (on multiplie les taux par 100 pour l'affichage en %)
    if (hourlyRateInput) hourlyRateInput.value = CHARGED_HOURLY_RATE.toFixed(2);
    if (overheadInput) overheadInput.value = Math.round(OVERHEAD_RATE * 100);
    if (targetMarginInput) targetMarginInput.value = Math.round(TARGET_NET_MARGIN * 100);
    if (vatInput) vatInput.value = (VAT_RATE * 100).toFixed(1);

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const hr = parseFloat(hourlyRateInput.value);
        const oh = parseFloat(overheadInput.value);
        const margin = parseFloat(targetMarginInput.value);
        const vat = parseFloat(vatInput.value);

        if (isNaN(hr) || hr < 0 || isNaN(oh) || oh < 0 || oh > 100 || isNaN(margin) || margin < 0 || margin > 100 || isNaN(vat) || vat < 0 || vat > 100) {
            showToast('Veuillez saisir des valeurs valides.', 'error');
            return;
        }

        // Sauvegarder dans localStorage
        localStorage.setItem('settings-charged-hourly-rate', hr.toString());
        localStorage.setItem('settings-overhead-rate', oh.toString());
        localStorage.setItem('settings-target-net-margin', margin.toString());
        localStorage.setItem('settings-vat-rate', vat.toString());

        // Mettre à jour les live bindings de data.js
        updateGlobalSettings();

        // Rafraîchir l'affichage du dashboard
        displayStats();
        displayNotifications();

        showToast('Paramètres de simulation enregistrés et appliqués !', 'success', 2000);
    });
}

function displayStats() {
    document.getElementById('total-recipes').textContent = recipes.length;
    document.getElementById('total-ingredients').textContent = mercuriale.length;

    // Calculate margins and profitability
    let sumMargins = 0;
    let countMargins = 0;
    let bestRecipeName = 'Aucune';
    let bestRecipeMargin = -1;

    recipes.forEach(recipe => {
        const netMargin = calculateNetMargin(recipe);
        const actualPVHT = calculateActualPriceHTPerServing(recipe);
        if (actualPVHT > 0) {
            sumMargins += netMargin;
            countMargins++;

            if (netMargin > bestRecipeMargin) {
                bestRecipeMargin = netMargin;
                bestRecipeName = recipe.name;
            }
        }
    });

    const avgMargin = countMargins > 0 ? sumMargins / countMargins : 0;
    const missingPricesCount = mercuriale.filter(ing => ing.price === null || ing.price === undefined || ing.price === '').length;
    const healthPercent = mercuriale.length > 0 ? ((mercuriale.length - missingPricesCount) / mercuriale.length) * 100 : 100;

    document.getElementById('avg-margin').textContent = formatPercent(avgMargin);
    document.getElementById('top-recipe').textContent = bestRecipeName;
    if (bestRecipeName !== 'Aucune') {
        document.getElementById('top-recipe').title = `${bestRecipeName} (${formatPercent(bestRecipeMargin)} de marge)`;
    }
    document.getElementById('missing-prices').textContent = missingPricesCount;
    document.getElementById('mercuriale-health').textContent = formatPercent(healthPercent, 0);

    // Apply color coding to health and missing prices
    const missingPricesEl = document.getElementById('missing-prices');
    if (missingPricesCount > 0) {
        missingPricesEl.style.color = 'var(--margin-low)';
    } else {
        missingPricesEl.style.color = 'var(--margin-high)';
    }

    const healthEl = document.getElementById('mercuriale-health');
    if (healthPercent >= 90) {
        healthEl.style.color = 'var(--margin-high)';
    } else if (healthPercent >= 70) {
        healthEl.style.color = 'var(--margin-medium)';
    } else {
        healthEl.style.color = 'var(--margin-low)';
    }
}

export function displayNotifications() {
    const notificationsList = document.getElementById('notifications-list');
    if (!notificationsList) return;
    notificationsList.innerHTML = '';
    let hasNotifications = false;

    mercuriale.forEach(ing => {
        let messages = [];
        if (ing.price === null || ing.price === undefined || ing.price === '') {
            messages.push("prix manquant");
        }
        if (!ing.unit) {
            messages.push("unité manquante");
        }
        if (!ing.family) {
            messages.push("famille manquante");
        }
        
        if(messages.length > 0) {
            const li = document.createElement('li');
            li.innerHTML = `<span class="icon">⚠️</span> Pour <strong>${escapeHTML(ing.name)}</strong>: ${messages.map(escapeHTML).join(', ')}. <a href="mercuriale.html">Mettre à jour</a>`;
            notificationsList.appendChild(li);
            hasNotifications = true;
        }
    });

    recipes.forEach(recipe => {
        if (!recipe.servings || recipe.servings <= 0) {
            const li = document.createElement('li');
            li.innerHTML = `<span class="icon">⚠️</span> Nombre de portions manquant pour la recette : <strong>${escapeHTML(recipe.name)}</strong>. <a href="recettes.html">Mettre à jour</a>`;
            notificationsList.appendChild(li);
            hasNotifications = true;
        }
        
        recipe.ingredients.forEach(item => {
            if (!item.quantity || item.quantity <= 0) {
                 const ingredient = getIngredientById(item.ingredientId);
                 if(ingredient) {
                    const li = document.createElement('li');
                    li.innerHTML = `<span class="icon">⚠️</span> Quantité manquante pour <strong>${escapeHTML(ingredient.name)}</strong> dans la recette <strong>${escapeHTML(recipe.name)}</strong>. <a href="recettes.html">Mettre à jour</a>`;
                    notificationsList.appendChild(li);
                    hasNotifications = true;
                 }
            }
        });
    });
    
    if(!hasNotifications) {
        notificationsList.innerHTML = '<li><span class="icon">✅</span> Aucune notification. Tout est en ordre !</li>';
    }
}