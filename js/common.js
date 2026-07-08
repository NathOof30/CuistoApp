export function formatCurrency(amount) {
    if (typeof amount !== 'number') {
        amount = 0;
    }
    // Arrondir à la dizaine de centimes supérieure (0.10 €)
    let rounded = Math.ceil(amount * 10) / 10;
    // Si le prix unitaire est très faible (inférieur à 10 cts, ex: ingrédients au gramme),
    // arrondir au centime supérieur pour éviter de gonfler artificiellement à 0.10 €
    if (amount > 0 && amount < 0.10) {
        rounded = Math.ceil(amount * 100) / 100;
    }
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(rounded);
}

// Format avec 3 décimales désormais aligné sur 2 décimales pour respecter la consigne
export function formatCurrency3(amount) {
    return formatCurrency(amount);
}

const COUNTABLE_UNITS = [
    'piece', 'pieces', 'pièce', 'pièces', 'boite', 'boîte', 'boites', 'boîtes',
    'unite', 'unité', 'unites', 'unités', 'portion', 'portions', 'pcs'
];

function normalizeUnit(unit) {
    return String(unit ?? '').toLowerCase().trim();
}

export function isCountUnit(unit) {
    const normalizedUnit = normalizeUnit(unit);
    return COUNTABLE_UNITS.includes(normalizedUnit);
}

function formatQuantityValue(value, unit) {
    const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : 0;
    const digits = isCountUnit(unit) ? 0 : 3;
    return {
        plain: numericValue.toFixed(digits),
        localized: new Intl.NumberFormat('fr-FR', {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        }).format(numericValue)
    };
}

// Format pourcentage avec précision paramétrable
export function formatPercent(value, decimals = 1) {
    if (typeof value !== 'number') {
        value = 0;
    }
    return value.toFixed(decimals) + '%';
}

// Format durée en minutes vers heures:minutes
export function formatDuration(minutes) {
    if (typeof minutes !== 'number' || minutes <= 0) {
        return 'N/A';
    }
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs === 0) {
        return `${mins} min`;
    }
    return `${hrs}h${mins > 0 ? mins.toString().padStart(2, '0') : ''}`;
}

export function escapeHTML(unsafe) {
    const div = document.createElement('div');
    div.textContent = String(unsafe ?? '');
    return div.innerHTML;
}

// Format quantité pour l'affichage dans l'interface
export function formatQuantity(value, unit) {
    return formatQuantityValue(value, unit).localized;
}

// Format quantité brut pour les champs de saisie et exports
export function formatQuantityPlain(value, unit) {
    return formatQuantityValue(value, unit).plain;
}

// Alias explicite pour les champs <input type="number">
export function formatQuantityInput(value, unit) {
    return formatQuantityPlain(value, unit);
}

