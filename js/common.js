export function formatCurrency(amount) {
    if (typeof amount !== 'number') {
        amount = 0;
    }
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
}

// Format avec 3 décimales pour plus de précision (ex: coûts de recettes)
export function formatCurrency3(amount) {
    if (typeof amount !== 'number') {
        amount = 0;
    }
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 3,
        maximumFractionDigits: 3
    }).format(amount);
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

// Format quantité : 0 décimales pour pièce/boîte, 3 décimales sinon
export function formatQuantity(value, unit) {
    if (typeof value !== 'number') value = 0;
    const u = (unit || '').toLowerCase().trim();
    if (u === 'pièce' || u === 'piece' || u === 'boîte' || u === 'boite') {
        return value % 1 === 0 ? value.toString() : value.toFixed(0);
    }
    return parseFloat(value.toFixed(3)).toString();
}

