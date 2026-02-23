import { mercuriale, recipes, calculateRecipeCost, getIngredientById } from '../data.js';
import { formatCurrency, escapeHTML } from './common.js';

// Utiliser les exports directement pour éviter l'état obsolète

export function initDashboard() {
    displayStats();
    displayNotifications();
    
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

function displayStats() {
    document.getElementById('total-recipes').textContent = recipes.length;
    document.getElementById('total-ingredients').textContent = mercuriale.length;
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