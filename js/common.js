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

export function formatUnitPrice(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) {
        amount = 0;
    }
    if (amount <= 0) return '0,00 €';
    if (amount < 0.05) {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 3,
            maximumFractionDigits: 4
        }).format(amount);
    }
    return formatCurrency(amount);
}

// Format avec 3 décimales désormais aligné sur 2 décimales pour respecter la consigne
export function formatCurrency3(amount) {
    return formatCurrency(amount);
}

const COUNTABLE_UNITS = [
    'piece', 'pieces', 'pièce', 'pièces', 'boite', 'boîte', 'boites', 'boîtes',
    'unite', 'unité', 'unites', 'unités', 'portion', 'portions', 'pcs', 'pc', 'pce', 'pces',
    'lot', 'lots', 'botte', 'bottes', 'sachet', 'sachets', 'bouteille', 'bouteilles'
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
    const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : parseFloat(value) || 0;
    if (isCountUnit(unit)) {
        return String(Math.round(numericValue));
    }
    // Éviter les traînées de zéros inutiles tout en restant propre (ex: 600 ou 0.6 au lieu de 600.000)
    const formatted = parseFloat(numericValue.toFixed(4));
    return String(formatted);
}

// === MOTEUR DE CONVERSION D'UNITÉS CULINAIRES ===
const UNIT_FACTORS = {
    // Masse (unité de base: g)
    'g': 1,
    'gr': 1,
    'grs': 1,
    'gm': 1,
    'g.': 1,
    'gramme': 1,
    'grammes': 1,
    'kg': 1000,
    'kgs': 1000,
    'kilo': 1000,
    'kilos': 1000,
    'kg.': 1000,
    'kilogramme': 1000,
    'kilogrammes': 1000,
    'mg': 0.001,
    'mgs': 0.001,
    'mg.': 0.001,

    // Volume (unité de base: ml)
    'ml': 1,
    'mls': 1,
    'ml.': 1,
    'millilitre': 1,
    'millilitres': 1,
    'cl': 10,
    'cls': 10,
    'cl.': 10,
    'centilitre': 10,
    'centilitres': 10,
    'dl': 100,
    'dls': 100,
    'dl.': 100,
    'décilitre': 100,
    'décilitres': 100,
    'l': 1000,
    'ls': 1000,
    'l.': 1000,
    'lit': 1000,
    'litre': 1000,
    'litres': 1000
};

/**
 * Convertit une quantité depuis l'unité d'utilisation vers l'unité d'achat.
 * Exemple: convertUnitQuantity(250, 'g', 'kg') => 0.25 (car 250 g = 0.25 kg)
 */
export function convertUnitQuantity(qty, fromUnit, toUnit) {
    const numQty = typeof qty === 'number' && Number.isFinite(qty) ? qty : parseFloat(qty) || 0;
    const fromNorm = normalizeUnit(fromUnit);
    const toNorm = normalizeUnit(toUnit);

    if (fromNorm === toNorm || !fromNorm || !toNorm) return numQty;

    const fromFactor = UNIT_FACTORS[fromNorm];
    const toFactor = UNIT_FACTORS[toNorm];

    if (fromFactor && toFactor) {
        const baseQty = numQty * fromFactor;
        return baseQty / toFactor;
    }

    return numQty;
}

/**
 * Convertit une quantité d'une unité à une autre pour l'interface (ex: bascule g <-> kg)
 */
export function convertQuantityBetweenUnits(qty, fromUnit, toUnit) {
    const numQty = typeof qty === 'number' && Number.isFinite(qty) ? qty : parseFloat(qty);
    if (isNaN(numQty) || numQty <= 0) return '';
    const fromNorm = normalizeUnit(fromUnit);
    const toNorm = normalizeUnit(toUnit);
    if (fromNorm === toNorm || !fromNorm || !toNorm) return numQty;

    // Détection d'erreur de saisie classique : l'utilisateur avait tapé 0.6 en pensant être en kg,
    // mais le sélecteur était sur 'g'. S'il bascule maintenant sur 'kg', il veut 0.6 kg (pas 0.0006 kg).
    if (fromNorm === 'g' && toNorm === 'kg' && numQty < 1) {
        return numQty;
    }
    if ((fromNorm === 'ml' || fromNorm === 'cl') && toNorm === 'l' && numQty < 1) {
        return numQty;
    }

    const fromFactor = UNIT_FACTORS[fromNorm];
    const toFactor = UNIT_FACTORS[toNorm];
    if (fromFactor && toFactor) {
        const converted = (numQty * fromFactor) / toFactor;
        // Arrondi propre pour éviter les artefacts flottants (ex: 0.6000000000000001)
        return parseFloat(converted.toFixed(4));
    }
    return numQty;
}

/**
 * Retourne la liste des unités d'utilisation compatibles avec une unité d'achat.
 */
export function getCompatibleUnits(unit) {
    const norm = normalizeUnit(unit);
    const massUnits = ['g', 'gr', 'grs', 'gm', 'g.', 'gramme', 'grammes', 'kg', 'kgs', 'kilo', 'kilos', 'kg.', 'kilogramme', 'kilogrammes', 'mg', 'mgs', 'mg.'];
    const volumeUnits = ['l', 'ls', 'l.', 'lit', 'litre', 'litres', 'cl', 'cls', 'cl.', 'centilitre', 'centilitres', 'ml', 'mls', 'ml.', 'millilitre', 'millilitres', 'dl', 'dls', 'dl.', 'décilitre', 'décilitres'];

    if (massUnits.includes(norm)) {
        if (['kg', 'kgs', 'kilo', 'kilos', 'kg.', 'kilogramme', 'kilogrammes'].includes(norm)) {
            return ['kg', 'g'];
        }
        return ['g', 'kg'];
    }
    if (volumeUnits.includes(norm)) {
        if (['l', 'ls', 'l.', 'lit', 'litre', 'litres'].includes(norm)) {
            return ['L', 'cl', 'ml'];
        }
        if (['cl', 'cls', 'cl.', 'centilitre', 'centilitres'].includes(norm)) {
            return ['cl', 'ml', 'L'];
        }
        return ['ml', 'cl', 'L'];
    }
    return [unit || 'pièce'];
}

