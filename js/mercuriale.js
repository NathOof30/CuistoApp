import { mercuriale, recipes, getIngredientById, saveData, EU_ALLERGENS, nextIngredientId } from '../data.js';
import { formatCurrency, formatCurrency3, escapeHTML } from './common.js';
import { displayNotifications } from './dashboard.js';
import { showToast, showConfirm } from './ui-feedback.js';

let currentSortColumn = 'name';
let currentSortDirection = 'asc';

export function initMercurialePage() {
    const addIngredientBtn = document.getElementById('add-ingredient-btn');
    const modal = document.getElementById('ingredient-modal');
    const searchInput = document.getElementById('search-ingredient');
    const filterSelect = document.getElementById('filter-family');

    generateAllergenCheckboxes();
    populateFamilyFilter();
    renderMercurialeTable();

    addIngredientBtn.addEventListener('click', () => showIngredientModal());
    
    if (searchInput) {
        searchInput.addEventListener('input', () => renderMercurialeTable());
    }
    if (filterSelect) {
        filterSelect.addEventListener('change', () => renderMercurialeTable());
    }

    // Handle column sorting click events
    document.querySelectorAll('#mercuriale-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const sortKey = th.dataset.sort;
            if (currentSortColumn === sortKey) {
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortColumn = sortKey;
                currentSortDirection = 'asc';
            }
            
            // Update sort icon indicators in all headers
            document.querySelectorAll('#mercuriale-table th.sortable').forEach(header => {
                const iconSpan = header.querySelector('.sort-icon');
                if (header.dataset.sort === currentSortColumn) {
                    iconSpan.textContent = currentSortDirection === 'asc' ? '↑' : '↓';
                } else {
                    iconSpan.textContent = '↕';
                }
            });
            renderMercurialeTable();
        });
    });

    const form = document.getElementById('ingredient-form');
    form.addEventListener('submit', handleIngredientFormSubmit);
    document.getElementById('cancel-btn').addEventListener('click', () => closeModal(modal));

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (modal.style.display !== 'none') closeModal(modal);
            const detailsModal = document.getElementById('ingredient-details-modal');
            if (detailsModal && detailsModal.style.display !== 'none') closeModal(detailsModal);
        }
    });

    // Close modal on click outside content
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });

    const detailsModal = document.getElementById('ingredient-details-modal');
    if (detailsModal) {
        detailsModal.addEventListener('click', (e) => { if (e.target === detailsModal) closeModal(detailsModal); });
        const closeBtn = document.getElementById('details-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => { closeModal(detailsModal); });
        }
    }

    if (localStorage.getItem('openIngredientModal') === 'true') {
        localStorage.removeItem('openIngredientModal');
        showIngredientModal();
    }
}

function closeModal(modal) {
    modal.style.display = 'none';
}

// === GÉNÉRATION D'OPTIONS POUR LE FILTRE PAR FAMILLE ===
function populateFamilyFilter() {
    const filterSelect = document.getElementById('filter-family');
    if (!filterSelect) return;
    const currentVal = filterSelect.value;
    
    // Extract unique non-empty families from the mercuriale
    const families = [...new Set(mercuriale.map(i => i.family).filter(Boolean))].sort();
    
    let html = '<option value="">Toutes les familles</option>';
    families.forEach(fam => {
        html += `<option value="${escapeHTML(fam)}" ${fam === currentVal ? 'selected' : ''}>${escapeHTML(fam)}</option>`;
    });
    
    filterSelect.innerHTML = html;
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
export function renderMercurialeTable() {
    const tableBody = document.querySelector('#mercuriale-table tbody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const searchInput = document.getElementById('search-ingredient');
    const filterSelect = document.getElementById('filter-family');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const familyFilter = filterSelect ? filterSelect.value : '';

    let filteredMercuriale = mercuriale.filter(ing => {
        const matchesSearch = ing.name.toLowerCase().includes(searchTerm) ||
            (ing.family && ing.family.toLowerCase().includes(searchTerm)) ||
            (ing.subfamily && ing.subfamily.toLowerCase().includes(searchTerm));
        const matchesFamily = !familyFilter || ing.family === familyFilter;
        return matchesSearch && matchesFamily;
    });

    if (filteredMercuriale.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="table-empty">Aucune denrée trouvée.</td></tr>`;
        return;
    }

    // Trier les denrées
    filteredMercuriale.sort((a, b) => {
        let valA = a[currentSortColumn];
        let valB = b[currentSortColumn];

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (typeof valA === 'string') {
            const cmp = valA.localeCompare(valB, 'fr', { sensitivity: 'base' });
            return currentSortDirection === 'asc' ? cmp : -cmp;
        } else {
            // Comparaison numérique
            return currentSortDirection === 'asc' ? valA - valB : valB - valA;
        }
    });

    filteredMercuriale.forEach(ing => {
        const row = document.createElement('tr');
        row.dataset.id = ing.id;
        row.style.cursor = 'pointer';
        const allergensDisplay = renderAllergenIcons(ing.allergens);

        row.innerHTML = `
            <td data-label="Intitulé">${escapeHTML(ing.name)}</td>
            <td data-label="Unité">${escapeHTML(ing.unit)}</td>
            <td data-label="Prix HT / unité" class="text-right font-mono">${ing.price !== null && ing.price !== undefined ? formatCurrency3(ing.price) : '<span class="price-missing">N/A</span>'}</td>
            <td data-label="Famille">${escapeHTML(ing.family || '—')}</td>
            <td data-label="Sous-famille">${escapeHTML(ing.subfamily || '—')}</td>
            <td data-label="Allergènes" class="allergen-cell">${allergensDisplay}</td>
        `;
        row.addEventListener('click', () => showIngredientDetails(ing.id));
        tableBody.appendChild(row);
    });
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
    form.querySelectorAll('input[name="allergens"]').forEach(cb => cb.checked = false);

    // Récupérer les familles et sous-familles uniques existantes
    const uniqueFamilies = [...new Set(mercuriale.map(i => i.family).filter(Boolean))].sort();
    const uniqueSubfamilies = [...new Set(mercuriale.map(i => i.subfamily).filter(Boolean))].sort();

    const familySelect = document.getElementById('ingredient-family-select');
    const familyCustomInput = document.getElementById('ingredient-family-custom');
    const subfamilySelect = document.getElementById('ingredient-subfamily-select');
    const subfamilyCustomInput = document.getElementById('ingredient-subfamily-custom');

    // Peupler le select Famille
    familySelect.innerHTML = `<option value="">— Choisir...</option>` +
        uniqueFamilies.map(fam => `<option value="${escapeHTML(fam)}">${escapeHTML(fam)}</option>`).join('') +
        `<option value="__other__">[Autre...]</option>`;

    // Peupler le select Sous-famille
    subfamilySelect.innerHTML = `<option value="">— Choisir...</option>` +
        uniqueSubfamilies.map(sub => `<option value="${escapeHTML(sub)}">${escapeHTML(sub)}</option>`).join('') +
        `<option value="__other__">[Autre...]</option>`;

    // Gestion de l'affichage du champ personnalisé "Autre..."
    familySelect.onchange = () => {
        if (familySelect.value === '__other__') {
            familyCustomInput.style.display = 'block';
            familyCustomInput.required = true;
        } else {
            familyCustomInput.style.display = 'none';
            familyCustomInput.required = false;
        }
    };

    subfamilySelect.onchange = () => {
        if (subfamilySelect.value === '__other__') {
            subfamilyCustomInput.style.display = 'block';
            subfamilyCustomInput.required = true;
        } else {
            subfamilyCustomInput.style.display = 'none';
            subfamilyCustomInput.required = false;
        }
    };

    if (ingredientId) {
        const ingredient = getIngredientById(parseInt(ingredientId));
        if (!ingredient) return;
        document.getElementById('modal-title').textContent = 'Modifier la denrée';
        document.getElementById('ingredient-id').value = ingredient.id;
        document.getElementById('ingredient-name').value = ingredient.name;
        document.getElementById('ingredient-unit').value = ingredient.unit;
        document.getElementById('ingredient-price').value =
            ingredient.price !== null && ingredient.price !== undefined ? ingredient.price.toFixed(3) : '';

        // Charger Famille
        if (ingredient.family) {
            if (uniqueFamilies.includes(ingredient.family)) {
                familySelect.value = ingredient.family;
                familyCustomInput.style.display = 'none';
                familyCustomInput.value = '';
            } else {
                familySelect.value = '__other__';
                familyCustomInput.style.display = 'block';
                familyCustomInput.value = ingredient.family;
            }
        } else {
            familySelect.value = '';
            familyCustomInput.style.display = 'none';
            familyCustomInput.value = '';
        }

        // Charger Sous-famille
        if (ingredient.subfamily) {
            if (uniqueSubfamilies.includes(ingredient.subfamily)) {
                subfamilySelect.value = ingredient.subfamily;
                subfamilyCustomInput.style.display = 'none';
                subfamilyCustomInput.value = '';
            } else {
                subfamilySelect.value = '__other__';
                subfamilyCustomInput.style.display = 'block';
                subfamilyCustomInput.value = ingredient.subfamily;
            }
        } else {
            subfamilySelect.value = '';
            subfamilyCustomInput.style.display = 'none';
            subfamilyCustomInput.value = '';
        }

        if (Array.isArray(ingredient.allergens)) {
            ingredient.allergens.forEach(allergenId => {
                const checkbox = form.querySelector(`input[name="allergens"][value="${allergenId}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
    } else {
        document.getElementById('modal-title').textContent = 'Ajouter une denrée';
        document.getElementById('ingredient-id').value = '';
        familySelect.value = '';
        familyCustomInput.style.display = 'none';
        familyCustomInput.value = '';
        subfamilySelect.value = '';
        subfamilyCustomInput.style.display = 'none';
        subfamilyCustomInput.value = '';
    }
    modal.style.display = 'flex';
}

// === SAUVEGARDE ===
function handleIngredientFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const ingredientId = form.querySelector('#ingredient-id').value;
    const priceValue = form.querySelector('#ingredient-price').value;

    const selectedAllergens = [];
    form.querySelectorAll('input[name="allergens"]:checked').forEach(cb => {
        selectedAllergens.push(cb.value);
    });

    // Récupérer la famille (select ou input libre)
    let family = form.querySelector('#ingredient-family-select').value;
    if (family === '__other__') {
        family = form.querySelector('#ingredient-family-custom').value.trim();
    }

    // Récupérer la sous-famille (select ou input libre)
    let subfamily = form.querySelector('#ingredient-subfamily-select').value;
    if (subfamily === '__other__') {
        subfamily = form.querySelector('#ingredient-subfamily-custom').value.trim();
    }

    const ingredientData = {
        id: ingredientId ? parseInt(ingredientId) : nextIngredientId(),
        name: form.querySelector('#ingredient-name').value.trim(),
        unit: form.querySelector('#ingredient-unit').value.trim(),
        price: priceValue !== '' ? parseFloat(priceValue) : null,
        family: family,
        subfamily: subfamily,
        allergens: selectedAllergens
    };

    if (ingredientId) {
        const index = mercuriale.findIndex(i => i.id == ingredientId);
        mercuriale[index] = ingredientData;
    } else {
        mercuriale.push(ingredientData);
    }

    saveData(recipes, mercuriale);
    populateFamilyFilter();
    renderMercurialeTable();
    document.getElementById('ingredient-modal').style.display = 'none';
    showToast(ingredientId ? 'Denrée modifiée avec succès.' : 'Denrée ajoutée avec succès.', 'success');

    if (document.getElementById('notifications-list')) {
        displayNotifications();
    }
}

function deleteIngredient(ingredientId) {
    const usedIn = recipes.filter(r =>
        r.ingredients && r.ingredients.some(i => i.ingredientId == ingredientId)
    );
    const ingredient = getIngredientById(parseInt(ingredientId));
    const name = ingredient ? escapeHTML(ingredient.name) : 'cette denrée';

    let message = `Supprimer <strong>${name}</strong> ?`;
    if (usedIn.length > 0) {
        const recipeNames = usedIn.map(r => `<em>${escapeHTML(r.name)}</em>`).join(', ');
        message += `<br><br>⚠️ Elle est utilisée dans ${usedIn.length} recette(s) : ${recipeNames}.<br>Les calculs de coûts de ces recettes seront impactés.`;
    }

    showConfirm(message, () => {
        const idx = mercuriale.findIndex(i => i.id == ingredientId);
        if (idx !== -1) {
            mercuriale.splice(idx, 1);
            saveData(recipes, mercuriale);
        }
        populateFamilyFilter();
        renderMercurialeTable();
        showToast('Denrée supprimée.', 'warning');
    }, {
        title: 'Supprimer une denrée',
        confirmLabel: 'Supprimer',
        cancelLabel: 'Annuler',
        danger: true
    });
}

export function showIngredientDetails(ingredientId) {
    const ingredient = getIngredientById(parseInt(ingredientId));
    if (!ingredient) return;

    const modal = document.getElementById('ingredient-details-modal');
    const content = document.getElementById('ingredient-details-content');
    if (!modal || !content) return;

    const allergenDetails = EU_ALLERGENS.filter(a => ingredient.allergens && ingredient.allergens.includes(a.id));
    const allergensHtml = allergenDetails.length > 0
        ? allergenDetails.map(a => `<span class="allergen-badge-item" title="${a.description}">${a.icon} ${a.name}</span>`).join(' ')
        : '<em>Aucun allergène renseigné.</em>';

    content.innerHTML = `
        <div class="details-layout">
            <div class="details-header-info">
                <h2>${escapeHTML(ingredient.name)}</h2>
                <div class="details-meta-grid">
                    <div><strong>Unité:</strong> ${escapeHTML(ingredient.unit)}</div>
                    <div><strong>Famille:</strong> ${escapeHTML(ingredient.family || '—')}</div>
                    <div><strong>Sous-famille:</strong> ${escapeHTML(ingredient.subfamily || '—')}</div>
                </div>
            </div>

            <div class="details-grid-kpis">
                <div class="kpi-card" style="grid-column: 1 / -1;">
                    <span class="kpi-label">Prix Unitaire HT</span>
                    <span class="kpi-value">${ingredient.price !== null && ingredient.price !== undefined ? formatCurrency3(ingredient.price) + ' / ' + escapeHTML(ingredient.unit) : '<span class="price-missing">Non spécifié (N/A)</span>'}</span>
                </div>
            </div>

            <div class="details-section-title">Allergènes de la denrée</div>
            <div class="details-allergens-box">
                ${allergensHtml}
            </div>
        </div>
    `;

    // Hook up buttons
    document.getElementById('details-edit-btn').onclick = () => {
        modal.style.display = 'none';
        showIngredientModal(ingredientId);
    };

    document.getElementById('details-delete-btn').onclick = () => {
        deleteIngredient(ingredientId);
        modal.style.display = 'none';
    };

    modal.style.display = 'flex';
}