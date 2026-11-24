export function roundCurrency(amount) {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) return 0;
    const rounded = Math.sign(amount) * Math.round((Math.abs(amount) + 1e-12) * 100) / 100;
    return Object.is(rounded, -0) ? 0 : rounded;
}

export function formatCurrency(amount) {
    const rounded = roundCurrency(amount);
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(rounded);
}

export function formatUnitPrice(amount) {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
        amount = 0;
    }
    if (amount <= 0) return formatCurrency(0);
    if (amount < 0.01) {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 3,
            maximumFractionDigits: 4
        }).format(amount);
    }
    return formatCurrency(amount);
}

// Alias historique aligné sur l'arrondi standard à 2 décimales
export function formatCurrency3(amount) {
    return formatCurrency(amount);
}

const COUNTABLE_UNITS = [
    'piece', 'pieces', 'pièce', 'pièces', 'p',
    'boite', 'boîte', 'boites', 'boîtes',
    'barquette', 'barquettes',
    'unite', 'unité', 'unites', 'unités',
    'portion', 'portions', 'pcs', 'pc', 'pce', 'pces',
    'lot', 'lots', 'botte', 'bottes',
    'sachet', 'sachets', 'bouteille', 'bouteilles'
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

    if (isCountUnit(unit)) {
        const roundedInt = Math.round(numericValue);
        if (Math.abs(numericValue - roundedInt) < 1e-6) {
            const cleanInt = Object.is(roundedInt, -0) ? 0 : roundedInt;
            return {
                plain: String(cleanInt),
                localized: new Intl.NumberFormat('fr-FR', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                }).format(cleanInt)
            };
        }

        const rounded2 = roundCurrency(numericValue);
        if (rounded2 === 0 && numericValue !== 0) {
            const rounded3 = parseFloat(numericValue.toFixed(3));
            return {
                plain: String(rounded3),
                localized: new Intl.NumberFormat('fr-FR', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 3
                }).format(rounded3)
            };
        }

        const clean2 = parseFloat(rounded2.toFixed(2));
        return {
            plain: String(clean2),
            localized: new Intl.NumberFormat('fr-FR', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }).format(clean2)
        };
    }

    return {
        plain: numericValue.toFixed(3),
        localized: new Intl.NumberFormat('fr-FR', {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3
        }).format(numericValue)
    };
}

// Format poids en kg (avec option d'affichage des grammes entre parenthèses)
export function formatWeight(weightKg, { includeGrams = false, withUnit = true, showZero = false } = {}) {
    if (typeof weightKg !== 'number' || !Number.isFinite(weightKg) || weightKg < 0) {
        return '—';
    }
    if (weightKg === 0 && !showZero) {
        return '—';
    }
    const kgStr = new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3
    }).format(weightKg);
    const base = withUnit ? `${kgStr} kg` : kgStr;
    if (includeGrams) {
        const grams = Math.round(weightKg * 1000);
        const gramsStr = new Intl.NumberFormat('fr-FR', {
            maximumFractionDigits: 0
        }).format(grams);
        return `${base} (${gramsStr} g)`;
    }
    return base;
}

// Format taux en pourcentage sans tronquer les décimales utiles (ex: 5,5 % ou 10 %)
export function formatRate(ratePercent) {
    const numeric = typeof ratePercent === 'number' && Number.isFinite(ratePercent) ? ratePercent : 0;
    const rounded = roundCurrency(numeric);
    return `${new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(rounded)} %`;
}

// Format facteur multiplicateur/taux décimal sans tronquer (ex: 1,055 ou 1,10)
export function formatDecimalFactor(value) {
    const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 0;
    return new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4
    }).format(numeric);
}

// Format pourcentage avec précision paramétrable
export function formatPercent(value, decimals = 1) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        value = 0;
    }
    return value.toFixed(decimals) + '%';
}

// Format durée en minutes vers heures:minutes
export function formatDuration(minutes) {
    if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) {
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
    return String(unsafe ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Format quantité pour l'affichage dans l'interface
export function formatQuantity(value, unit) {
    return formatQuantityValue(value, unit).localized;
}

// Format quantité brut pour les champs de saisie et exports
export function formatQuantityPlain(value, unit) {
    return formatQuantityValue(value, unit).plain;
}

// Formatage propre pour les champs <input type="number"> sans jamais arrondir de force les unités comptables
export function formatQuantityInput(value, unit) {
    const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : parseFloat(value) || 0;
    const formatted = parseFloat(numericValue.toFixed(4));
    return String(Object.is(formatted, -0) ? 0 : formatted);
}

// === MOTEUR DE CONVERSION D'UNITÉS CULINAIRES (MASSES ET VOLUMES STRICTEMENT SÉPARÉS) ===
const MASS_FACTORS = {
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
    'mg.': 0.001
};

const VOLUME_FACTORS = {
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

export function getUnitFamily(unit) {
    const norm = normalizeUnit(unit);
    if (MASS_FACTORS[norm] !== undefined) return 'mass';
    if (VOLUME_FACTORS[norm] !== undefined) return 'volume';
    return 'other';
}

/**
 * Convertit une quantité depuis l'unité d'utilisation vers l'unité d'achat.
 * Empêche toute conversion inter-dimensions (masse <-> volume).
 * Exemple: convertUnitQuantity(250, 'g', 'kg') => 0.25 (car 250 g = 0.25 kg)
 */
export function convertUnitQuantity(qty, fromUnit, toUnit) {
    const numQty = typeof qty === 'number' && Number.isFinite(qty) ? qty : parseFloat(qty) || 0;
    const fromNorm = normalizeUnit(fromUnit);
    const toNorm = normalizeUnit(toUnit);

    if (fromNorm === toNorm || !fromNorm || !toNorm) return numQty;

    if (MASS_FACTORS[fromNorm] !== undefined && MASS_FACTORS[toNorm] !== undefined) {
        return (numQty * MASS_FACTORS[fromNorm]) / MASS_FACTORS[toNorm];
    }

    if (VOLUME_FACTORS[fromNorm] !== undefined && VOLUME_FACTORS[toNorm] !== undefined) {
        return (numQty * VOLUME_FACTORS[fromNorm]) / VOLUME_FACTORS[toNorm];
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

    if (MASS_FACTORS[fromNorm] !== undefined && MASS_FACTORS[toNorm] !== undefined) {
        const converted = (numQty * MASS_FACTORS[fromNorm]) / MASS_FACTORS[toNorm];
        return parseFloat(converted.toFixed(4));
    }

    if (VOLUME_FACTORS[fromNorm] !== undefined && VOLUME_FACTORS[toNorm] !== undefined) {
        const converted = (numQty * VOLUME_FACTORS[fromNorm]) / VOLUME_FACTORS[toNorm];
        return parseFloat(converted.toFixed(4));
    }

    return numQty;
}

/**
 * Retourne la liste des unités d'utilisation compatibles avec une unité d'achat.
 */
export function getCompatibleUnits(unit) {
    const norm = normalizeUnit(unit);

    if (MASS_FACTORS[norm] !== undefined) {
        if (['kg', 'kgs', 'kilo', 'kilos', 'kg.', 'kilogramme', 'kilogrammes'].includes(norm)) {
            return ['kg', 'g'];
        }
        return ['g', 'kg'];
    }
    if (VOLUME_FACTORS[norm] !== undefined) {
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
