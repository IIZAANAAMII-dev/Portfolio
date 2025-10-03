/**
 * Utilitaires généraux
 * Contient des fonctions utilitaires réutilisables dans toute l'application
 */

/**
 * Vérifie si un élément est visible dans le viewport
 * @param {HTMLElement} element - L'élément à vérifier
 * @param {number} offset - Décallage en pixels (par défaut: 0)
 * @returns {boolean} True si l'élément est visible, false sinon
 */
export function isInViewport(element, offset = 0) {
    if (!element) return false;
    
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;
    
    // Vérifier si l'élément est dans le viewport avec un offset
    return (
        rect.top + offset >= 0 &&
        rect.left + offset >= 0 &&
        rect.bottom - offset <= windowHeight &&
        rect.right - offset <= windowWidth
    );
}

/**
 * Détecte si l'utilisateur est sur un appareil mobile
 * @returns {boolean} True si l'utilisateur est sur mobile, false sinon
 */
export function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // Détecte les iPads
}

/**
 * Détecte si l'utilisateur préfère le mode sombre
 * @returns {boolean} True si le mode sombre est activé, false sinon
 */
export function prefersDarkMode() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Formate une durée en minutes en une chaîne lisible (ex: 2h 30min)
 * @param {number} minutes - Durée en minutes
 * @returns {string} Durée formatée
 */
export function formatDuration(minutes) {
    if (!minutes) return '';
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    let result = [];
    if (hours > 0) result.push(`${hours}h`);
    if (mins > 0 || hours === 0) result.push(`${mins}min`);
    
    return result.join(' ');
}

/**
 * Met la première lettre d'une chaîne en majuscule
 * @param {string} str - La chaîne à formater
 * @returns {string} La chaîne avec la première lettre en majuscule
 */
export function capitalizeFirstLetter(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Crée un élément HTML avec des attributs et du contenu
 * @param {string} tag - La balise HTML
 * @param {Object} attributes - Les attributs de l'élément
 * @param {string|HTMLElement|Array} content - Le contenu de l'élément
 * @returns {HTMLElement} L'élément HTML créé
 */
export function createElement(tag, attributes = {}, content = '') {
    const element = document.createElement(tag);
    
    // Ajouter les attributs
    for (const [key, value] of Object.entries(attributes)) {
        if (value !== null && value !== undefined) {
            element.setAttribute(key, value);
        }
    }
    
    // Ajouter le contenu
    if (content) {
        if (Array.isArray(content)) {
            content.forEach(item => {
                if (typeof item === 'string') {
                    element.appendChild(document.createTextNode(item));
                } else if (item instanceof HTMLElement) {
                    element.appendChild(item);
                }
            });
        } else if (typeof content === 'string') {
            element.textContent = content;
        } else if (content instanceof HTMLElement) {
            element.appendChild(content);
        }
    }
    
    return element;
}

/**
 * Désactive le défilement de la page
 * @param {boolean} disable - True pour désactiver le défilement, false pour le réactiver
 */
export function disableScroll(disable = true) {
    document.body.style.overflow = disable ? 'hidden' : '';
    document.documentElement.style.overflow = disable ? 'hidden' : '';
}

/**
 * Ajoute un écouteur d'événement avec gestion automatique du débordement
 * @param {HTMLElement} element - L'élément auquel ajouter l'écouteur
 * @param {string} event - Le type d'événement
 * @param {Function} handler - La fonction de gestionnaire
 * @param {Object} options - Les options de l'écouteur
 * @returns {Function} Une fonction pour supprimer l'écouteur
 */
export function addEventListenerWithCleanup(element, event, handler, options = {}) {
    if (!element) return () => {};
    
    element.addEventListener(event, handler, options);
    
    // Retourne une fonction pour supprimer l'écouteur
    return () => {
        element.removeEventListener(event, handler, options);
    };
}

/**
 * Crée un ID unique
 * @param {number} length - La longueur de l'ID (par défaut: 8)
 * @returns {string} Un ID unique
 */
export function createUniqueId(length = 8) {
    return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Formate une date au format lisible
 * @param {Date|string} date - La date à formater
 * @param {string} locale - La locale (par défaut: 'fr-FR')
 * @param {Object} options - Les options de formatage
 * @returns {string} La date formatée
 */
export function formatDate(date, locale = 'fr-FR', options = {}) {
    if (!date) return '';
    
    const defaultOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...options
    };
    
    const dateObj = date instanceof Date ? date : new Date(date);
    
    // Vérifier si la date est valide
    if (isNaN(dateObj.getTime())) return '';
    
    return dateObj.toLocaleDateString(locale, defaultOptions);
}

/**
 * Détecte si l'élément a un défilement (scrollbar)
 * @param {HTMLElement} element - L'élément à vérifier
 * @returns {Object} Un objet avec les propriétés vertical et horizontal
 */
export function hasScrollbar(element = document.documentElement) {
    return {
        vertical: element.scrollHeight > element.clientHeight,
        horizontal: element.scrollWidth > element.clientWidth
    };
}

/**
 * Détecte si le navigateur prend en charge une propriété CSS
 * @param {string} property - La propriété CSS à vérifier
 * @returns {boolean} True si la propriété est prise en charge, false sinon
 */
export function supportsCssProperty(property) {
    if (typeof window === 'undefined' || !window.CSS) return false;
    
    const style = document.createElement('div').style;
    
    // Vérifier la version préfixée
    const prefixes = ['', '-webkit-', '-moz-', '-ms-', '-o-'];
    const prop = property.charAt(0).toUpperCase() + property.slice(1);
    
    return prefixes.some(prefix => {
        return (prefix + property) in style || 
               (prefix + prop) in style;
    });
}

/**
 * Détecte si une image est chargée avec succès
 * @param {string} url - L'URL de l'image
 * @returns {Promise<boolean>} Une promesse qui se résout avec true si l'image est chargée avec succès
 */
export function isImageLoaded(url) {
    return new Promise((resolve) => {
        if (!url) {
            resolve(false);
            return;
        }
        
        const img = new Image();
        
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        
        img.src = url;
    });
}

/**
 * Détecte si l'utilisateur est en ligne
 * @returns {boolean} True si l'utilisateur est en ligne, false sinon
 */
export function isOnline() {
    return navigator.onLine;
}

/**
 * Copie du texte dans le presse-papier
 * @param {string} text - Le texte à copier
 * @returns {Promise<boolean>} Une promesse qui se résout avec true si la copie a réussi
 */
export async function copyToClipboard(text) {
    if (!text) return false;
    
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Erreur lors de la copie dans le presse-papier:', err);
        
        // Méthode de secours pour les navigateurs plus anciens
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            document.body.appendChild(textarea);
            textarea.select();
            
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            
            return success;
        } catch (err) {
            console.error('Échec de la méthode de secours:', err);
            return false;
        }
    }
}

/**
 * Déclenche un téléchargement de fichier
 * @param {string} data - Les données du fichier (URL ou Blob)
 * @param {string} filename - Le nom du fichier
 * @param {string} type - Le type MIME du fichier
 */
export function downloadFile(data, filename, type = 'application/octet-stream') {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Nettoyer
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);
}

/**
 * Formate un nombre avec des séparateurs de milliers
 * @param {number} number - Le nombre à formater
 * @param {string} locale - La locale (par défaut: 'fr-FR')
 * @returns {string} Le nombre formaté
 */
export function formatNumber(number, locale = 'fr-FR') {
    return new Intl.NumberFormat(locale).format(number);
}

/**
 * Limite l'exécution d'une fonction
 * @param {Function} func - La fonction à limiter
 * @param {number} limit - Le délai en millisecondes
 * @returns {Function} La fonction limitée
 */
export function throttle(func, limit = 100) {
    let inThrottle = false;
    
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            
            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }
    };
}

/**
 * Retarde l'exécution d'une fonction
 * @param {Function} func - La fonction à retarder
 * @param {number} delay - Le délai en millisecondes
 * @returns {Function} La fonction retardée
 */
export function debounce(func, delay = 100) {
    let timeoutId;
    
    return function(...args) {
        clearTimeout(timeoutId);
        
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

/**
 * Vérifie si un élément est un élément de formulaire
 * @param {HTMLElement} element - L'élément à vérifier
 * @returns {boolean} True si l'élément est un élément de formulaire, false sinon
 */
export function isFormElement(element) {
    if (!element) return false;
    
    const formElements = [
        'input', 'textarea', 'select', 'button', 'fieldset', 'output',
        'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'FIELDSET', 'OUTPUT'
    ];
    
    return formElements.includes(element.tagName) || 
           element.isContentEditable ||
           (element.hasAttribute('role') && 
            ['combobox', 'slider', 'spinbutton', 'textbox'].includes(element.getAttribute('role')));
}

/**
 * Obtient la position de défilement actuelle
 * @returns {Object} Un objet avec les propriétés x et y
 */
export function getScrollPosition() {
    return {
        x: window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft || 0,
        y: window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0
    };
}

/**
 * Fait défiler jusqu'à un élément en douceur
 * @param {HTMLElement|string} element - L'élément ou le sélecteur CSS
 * @param {Object} options - Les options de défilement
 */
export function smoothScrollTo(element, options = {}) {
    const {
        offset = 0,
        duration = 800,
        easing = 'easeInOutCubic',
        onComplete = () => {}
    } = options;
    
    const target = typeof element === 'string' ? document.querySelector(element) : element;
    
    if (!target) {
        console.warn('Élément non trouvé pour le défilement:', element);
        return;
    }
    
    const startPos = window.pageYOffset;
    const targetPos = target.getBoundingClientRect().top + window.pageYOffset;
    const distance = targetPos - startPos - offset;
    let startTime = null;
    
    // Fonctions d'accélération
    const easingFunctions = {
        linear: t => t,
        easeInQuad: t => t * t,
        easeOutQuad: t => t * (2 - t),
        easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
        easeInCubic: t => t * t * t,
        easeOutCubic: t => (--t) * t * t + 1,
        easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
        easeInQuart: t => t * t * t * t,
        easeOutQuart: t => 1 - (--t) * t * t * t,
        easeInOutQuart: t => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
        easeInQuint: t => t * t * t * t * t,
        easeOutQuint: t => 1 + (--t) * t * t * t * t,
        easeInOutQuint: t => t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t
    };
    
    // Fonction d'animation
    function animation(currentTime) {
        if (!startTime) startTime = currentTime;
        
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);
        const ease = easingFunctions[easing] || easingFunctions.easeInOutCubic;
        
        window.scrollTo(0, startPos + distance * ease(progress));
        
        if (timeElapsed < duration) {
            window.requestAnimationFrame(animation);
        } else {
            onComplete();
        }
    }
    
    // Démarrer l'animation
    window.requestAnimationFrame(animation);
}
