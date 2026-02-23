import { mercuriale, recipes, getIngredientById, saveData, EU_ALLERGENS } from '../data.js';
import { formatCurrency, formatCurrency3, escapeHTML } from './common.js';
import { displayNotifications } from './dashboard.js';

// Utiliser directement les exports pour éviter l'état obsolète

export function initMercurialePage() {
    const addIngredientBtn = document.getElementById('add-ingredient-btn');
    const modal = document.getElementById('ingredient-modal');
    const searchInput = document.getElementById('search-ingredient');

    // Générer les checkboxes d'allergènes une seule fois
    generateAllergenCheckboxes();

    renderMercurialeTable();

    addIngredientBtn.addEventListener('click', () => showIngredientModal());
    searchInput.addEventListener('input', () => renderMercurialeTable(searchInput.value));

    const form = document.getElementById('ingredient-form');
    form.addEventListener('submit', handleIngredientFormSubmit);
    document.getElementById('cancel-btn').addEventListener('click', () => {
        modal.style.display = 'none';
    });

    if (localStorage.getItem('openIngredientModal') === 'true') {
        localStorage.removeItem('openIngredientModal');
        showIngredientModal();
    }
}

// === GÉNÉRATION DES CHECKBOXES D'ALLERGÈNES ===
function generateAllergenCheckboxes() {
    const container = document.getElementById('allergen-checkboxes');
    if (!container) return;

    container.innerHTML = EU_ALLERGENS.map(allergen => `
        <label class="allergen-checkbox-label" title="${allergen.description}">
            <input type="checkbox" name="allergens" value="${allergen.id}">
            <span class="allergen-checkbox-icon">${allergen.icon}</span>
            <span class="allergen-checkbox-name">${allergen.name}</span>
        </label>
    `).join('');
}

// === RENDU DU TABLEAU ===
function renderMercurialeTable(searchTerm = '') {
    const tableBody = document.querySelector('#mercuriale-table tbody');
    tableBody.innerHTML = '';

    const filteredMercuriale = mercuriale.filter(ing =>
        ing.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ing.family && ing.family.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (ing.subfamily && ing.subfamily.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (filteredMercuriale.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Aucune denrée trouvée.</td></tr>`;
        return;
    }

    [...filteredMercuriale].sort((a, b) => a.name.localeCompare(b.name)).forEach(ing => {
        const row = document.createElement('tr');
        row.dataset.id = ing.id;

        // Générer l'affichage des allergènes
        const allergensDisplay = renderAllergenIcons(ing.allergens);

        row.innerHTML = `
            <td>${escapeHTML(ing.name)}</td>
            <td>${escapeHTML(ing.unit)}</td>
            <td>${ing.price !== null && ing.price !== undefined ? formatCurrency3(ing.price) : 'N/A'}</td>
            <td>${escapeHTML(ing.family || 'N/A')}</td>
            <td>${escapeHTML(ing.subfamily || 'N/A')}</td>
            <td class="allergen-cell">${allergensDisplay}</td>
            <td class="action-cell">
                <button class="edit-btn" data-id="${ing.id}">Modifier</button>
                <button class="delete-btn" data-id="${ing.id}">Supprimer</button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    tableBody.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', (e) => showIngredientModal(e.target.dataset.id)));
    tableBody.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', (e) => deleteIngredient(e.target.dataset.id)));
}

// === AFFICHAGE DES ICÔNES D'ALLERGÈNES ===
function renderAllergenIcons(allergens) {
    if (!allergens || allergens.length === 0) {
        return '<span class="no-allergen-text" title="Aucun allergène">–</span>';
    }

    const allergenDetails = EU_ALLERGENS.filter(a => allergens.includes(a.id));
    const icons = allergenDetails.map(a =>
        `<span class="allergen-icon-small" title="${a.name}: ${a.description}">${a.icon}</span>`
    ).join('');

    return `<div class="allergen-icons-container">${icons}</div>`;
}

// === MODAL INGRÉDIENT ===
function showIngredientModal(ingredientId = null) {
    const modal = document.getElementById('ingredient-modal');
    const form = document.getElementById('ingredient-form');
    form.reset();

    // Reset all allergen checkboxes
    form.querySelectorAll('input[name="allergens"]').forEach(cb => cb.checked = false);

    if (ingredientId) {
        const ingredient = getIngredientById(parseInt(ingredientId));
        document.getElementById('modal-title').textContent = 'Modifier la denrée';
        document.getElementById('ingredient-id').value = ingredient.id;
        document.getElementById('ingredient-name').value = ingredient.name;
        document.getElementById('ingredient-unit').value = ingredient.unit;
        // Afficher le prix avec 3 décimales
        document.getElementById('ingredient-price').value = ingredient.price !== null && ingredient.price !== undefined ? ingredient.price.toFixed(3) : '';
        document.getElementById('ingredient-family').value = ingredient.family;
        document.getElementById('ingredient-subfamily').value = ingredient.subfamily;

        // Cocher les allergènes de l'ingrédient
        if (Array.isArray(ingredient.allergens)) {
            ingredient.allergens.forEach(allergenId => {
                const checkbox = form.querySelector(`input[name="allergens"][value="${allergenId}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
    } else {
        document.getElementById('modal-title').textContent = 'Ajouter une denrée';
        document.getElementById('ingredient-id').value = '';
    }

    modal.style.display = 'flex';
}

// === SAUVEGARDE ===
function handleIngredientFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const ingredientId = form.querySelector('#ingredient-id').value;

    const priceValue = form.querySelector('#ingredient-price').value;

    // Récupérer les allergènes sélectionnés
    const selectedAllergens = [];
    form.querySelectorAll('input[name="allergens"]:checked').forEach(cb => {
        selectedAllergens.push(cb.value);
    });

    const ingredientData = {
        id: ingredientId ? parseInt(ingredientId) : Date.now(),
        name: form.querySelector('#ingredient-name').value,
        unit: form.querySelector('#ingredient-unit').value,
        price: priceValue !== '' ? parseFloat(priceValue) : null,
        family: form.querySelector('#ingredient-family').value,
        subfamily: form.querySelector('#ingredient-subfamily').value,
        allergens: selectedAllergens
    };

    if (ingredientId) {
        const index = mercuriale.findIndex(i => i.id == ingredientId);
        mercuriale[index] = ingredientData;
    } else {
        mercuriale.push(ingredientData);
    }

    saveData(recipes, mercuriale);
    renderMercurialeTable();
    document.getElementById('ingredient-modal').style.display = 'none';

    // Also update dashboard notifications if visible
    if (document.getElementById('notifications-list')) {
        displayNotifications();
    }
}

function deleteIngredient(ingredientId) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette denrée ? Cela pourrait affecter des recettes existantes.')) {
        const idx = mercuriale.findIndex(i => i.id == ingredientId);
        if (idx !== -1) {
            mercuriale.splice(idx, 1);
            saveData(recipes, mercuriale);
        }
        renderMercurialeTable();
    }
}