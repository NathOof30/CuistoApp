// ============================================
// UI Feedback — Toast & Confirm Dialog System
// Remplace window.alert() et window.confirm()
// ============================================

let toastContainer = null;

function getToastContainer() {
    if (!toastContainer || !document.body.contains(toastContainer)) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.setAttribute('aria-live', 'polite');
        toastContainer.setAttribute('aria-atomic', 'false');
        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}

const TOAST_ICONS = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
};

/**
 * Affiche une notification temporaire (toast).
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} type
 * @param {number} duration - ms avant disparition automatique
 */
export function showToast(message, type = 'info', duration = 3500) {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <span class="toast-icon">${TOAST_ICONS[type] || 'ℹ️'}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" aria-label="Fermer">✕</button>
    `;
    container.appendChild(toast);

    toast.querySelector('.toast-close').addEventListener('click', () => dismissToast(toast));

    // Force reflow then animate in
    void toast.offsetHeight;
    toast.classList.add('toast-visible');

    const timer = setTimeout(() => dismissToast(toast), duration);
    toast._timer = timer;
}

function dismissToast(toast) {
    clearTimeout(toast._timer);
    toast.classList.remove('toast-visible');
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 350);
}

/**
 * Affiche une modale de confirmation stylée (remplace window.confirm).
 * @param {string} message
 * @param {Function} onConfirm - callback si l'utilisateur confirme
 * @param {Object} options
 * @param {string} [options.title='Confirmation']
 * @param {string} [options.confirmLabel='Confirmer']
 * @param {string} [options.cancelLabel='Annuler']
 * @param {boolean} [options.danger=false] - bouton rouge si action destructive
 */
export function showConfirm(message, onConfirm, options = {}) {
    const {
        title = 'Confirmation',
        confirmLabel = 'Confirmer',
        cancelLabel = 'Annuler',
        danger = false
    } = options;

    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'confirm-dlg-title');
    overlay.setAttribute('aria-describedby', 'confirm-dlg-msg');

    overlay.innerHTML = `
        <div class="confirm-dialog">
            <h3 class="confirm-title" id="confirm-dlg-title">${title}</h3>
            <p class="confirm-message" id="confirm-dlg-msg">${message}</p>
            <div class="confirm-actions">
                <button class="button-secondary confirm-cancel">${cancelLabel}</button>
                <button class="${danger ? 'button-danger' : 'button-primary'} confirm-ok">${confirmLabel}</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Focus sur le bouton d'annulation par défaut (plus sûr)
    requestAnimationFrame(() => overlay.querySelector('.confirm-cancel').focus());

    function close(confirmed) {
        overlay.classList.remove('confirm-visible');
        document.removeEventListener('keydown', keyHandler);
        setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 250);
        if (confirmed) onConfirm();
    }

    overlay.querySelector('.confirm-cancel').addEventListener('click', () => close(false));
    overlay.querySelector('.confirm-ok').addEventListener('click', () => close(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });

    function keyHandler(e) {
        if (e.key === 'Escape') close(false);
        if (e.key === 'Enter' && document.activeElement === overlay.querySelector('.confirm-ok')) close(true);
    }
    document.addEventListener('keydown', keyHandler);

    // Animate in
    void overlay.offsetHeight;
    overlay.classList.add('confirm-visible');
}
