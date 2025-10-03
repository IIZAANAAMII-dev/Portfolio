/**
 * Fichier principal JavaScript
 * Initialise les modules et la configuration de l'application
 */

// Importer les modules ES
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { initNavigation } from './modules/navigation.js';
import { initAnimations } from './modules/animations.js';
import { initScrollEffects } from './modules/scroll.js';
import { initContactForm } from './modules/contact.js';
import { isMobile, prefersDarkMode } from './modules/utils.js';
import { CONFIG, GSAP_CONFIG, SCROLL_CONFIG } from './config.js';

// Enregistrer les plugins GSAP
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

// Configuration globale de GSAP
gsap.config({
    autoSleep: 60,
    force3D: true,
    nullTargetWarn: false,
    ...GSAP_CONFIG
});

// Configuration de ScrollTrigger
ScrollTrigger.config({
    autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load,resize,scroll',
    ignoreMobileResize: true,
    syncCallbacks: true
});

// Détecter le mode de réduction de mouvement
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// État global de l'application
const AppState = {
    isMobile: isMobile(),
    prefersDarkMode: prefersDarkMode(),
    prefersReducedMotion,
    isMenuOpen: false,
    currentSection: null,
    isScrolling: false,
    scrollPosition: 0,
    isAnimating: false
};

// Initialiser les modules
function init() {
    // Désactiver les animations si l'utilisateur préfère les réductions de mouvement
    if (AppState.prefersReducedMotion) {
        document.documentElement.classList.add('reduced-motion');
    }
    
    // Ajouter des classes d'assistance au body
    if (AppState.isMobile) {
        document.body.classList.add('is-mobile');
    } else {
        document.body.classList.add('is-desktop');
    }
    
    if (AppState.prefersDarkMode) {
        document.documentElement.classList.add('dark-mode');
    }
    
    // Initialiser les modules
    initNavigation();
    initAnimations();
    initScrollEffects();
    initContactForm();
    
    // Initialiser les écouteurs d'événements
    initEventListeners();
    
    // Afficher le contenu une fois que tout est chargé
    document.documentElement.classList.add('js-loaded');
    
    // Désactiver les animations pendant le redimensionnement de la fenêtre
    setupResizeHandler();
    
    // Initialiser le suivi de la section active
    initActiveSectionTracker();
    
    // Charger les polices de manière asynchrone
    loadFonts();
}

// Initialiser les écouteurs d'événements
function initEventListeners() {
    // Gérer le changement de mode sombre
    const darkModeToggle = document.querySelector('.dark-mode-toggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }
    
    // Gérer les clics sur les liens internes avec défilement fluide
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', handleInternalLinkClick);
    });
    
    // Gérer le rechargement de la page avec le bouton de navigation du navigateur
    window.addEventListener('pageshow', handlePageShow);
    
    // Gérer le défilement de la page
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Gérer le changement d'orientation
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Gérer le mode hors ligne
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOfflineStatus);
}

// Gérer le clic sur les liens internes
function handleInternalLinkClick(e) {
    const targetId = this.getAttribute('href');
    
    // Ne rien faire si ce n'est pas une ancre
    if (targetId === '#' || !targetId.startsWith('#')) {
        return;
    }
    
    e.preventDefault();
    
    const targetElement = document.querySelector(targetId);
    if (!targetElement) return;
    
    // Fermer le menu mobile s'il est ouvert
    if (AppState.isMenuOpen) {
        const menuToggle = document.querySelector('.menu-toggle');
        if (menuToggle) menuToggle.click();
    }
    
    // Faire défiler jusqu'à la cible
    scrollToElement(targetElement, {
        offset: -80,
        duration: SCROLL_CONFIG.DURATION,
        easing: SCROLL_CONFIG.EASING
    });
}

// Faire défiler jusqu'à un élément
function scrollToElement(element, options = {}) {
    if (!element || AppState.isScrolling) return;
    
    const {
        offset = 0,
        duration = 800,
        easing = 'power2.inOut'
    } = options;
    
    AppState.isScrolling = true;
    
    const startPos = window.pageYOffset;
    const targetPos = element.getBoundingClientRect().top + window.pageYOffset + offset;
    const distance = targetPos - startPos;
    let startTime = null;
    
    function animation(currentTime) {
        if (!startTime) startTime = currentTime;
        
        const timeElapsed = currentTime - startTime;
        const progress = Math.min(timeElapsed / duration, 1);
        const ease = gsap.parseEase(easing)(progress);
        
        window.scrollTo(0, startPos + distance * ease);
        
        if (timeElapsed < duration) {
            requestAnimationFrame(animation);
        } else {
            AppState.isScrolling = false;
            
            // Mettre à jour l'URL sans recharger la page
            const targetId = element.getAttribute('id');
            if (targetId) {
                history.pushState(null, '', `#${targetId}`);
            }
        }
    }
    
    requestAnimationFrame(animation);
}

// Suivre la section active pendant le défilement
function initActiveSectionTracker() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    
    function updateActiveSection() {
        let current = '';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');
            
            if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
                current = sectionId;
            }
        });
        
        if (current !== AppState.currentSection) {
            AppState.currentSection = current;
            
            // Mettre à jour les liens de navigation
            navLinks.forEach(link => {
                link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
            });
            
            // Déclencher un événement personnalisé
            document.dispatchEvent(new CustomEvent('sectionChange', {
                detail: { sectionId: current }
            }));
        }
    }
    
    // Mettre à jour la section active au chargement et au défilement
    window.addEventListener('load', updateActiveSection);
    window.addEventListener('scroll', updateActiveSection, { passive: true });
}

// Gérer le changement d'orientation
function handleOrientationChange() {
    // Rafraîchir ScrollTrigger après un changement d'orientation
    setTimeout(() => {
        ScrollTrigger.refresh();
    }, 300);
}

// Gérer le mode en ligne/hors ligne
function handleOnlineStatus() {
    showNotification('Vous êtes de nouveau en ligne', 'success');
}

function handleOfflineStatus() {
    showNotification('Vous êtes hors ligne. Certaines fonctionnalités peuvent être limitées.', 'warning');
}

// Afficher une notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animation d'entrée
    gsap.fromTo(notification,
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.3 }
    );
    
    // Supprimer la notification après un délai
    setTimeout(() => {
        gsap.to(notification, {
            opacity: 0,
            y: -20,
            duration: 0.3,
            onComplete: () => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }
        });
    }, 5000);
}

// Gérer le rechargement de la page
function handlePageShow(event) {
    if (event.persisted) {
        window.scrollTo(0, 0);
    }
}

// Configurer le gestionnaire de redimensionnement
function setupResizeHandler() {
    let resizeTimer;
    
    window.addEventListener('resize', () => {
        document.body.classList.add('resize-animation-stopper');
        clearTimeout(resizeTimer);
        
        resizeTimer = setTimeout(() => {
            document.body.classList.remove('resize-animation-stopper');
            
            // Rafraîchir ScrollTrigger après le redimensionnement
            ScrollTrigger.refresh();
        }, 400);
    });
}

// Basculer le mode sombre
function toggleDarkMode() {
    AppState.prefersDarkMode = !AppState.prefersDarkMode;
    
    if (AppState.prefersDarkMode) {
        document.documentElement.classList.add('dark-mode');
        localStorage.setItem('darkMode', 'enabled');
    } else {
        document.documentElement.classList.remove('dark-mode');
        localStorage.setItem('darkMode', 'disabled');
    }
    
    // Déclencher un événement personnalisé
    document.dispatchEvent(new CustomEvent('darkModeToggle', {
        detail: { isDarkMode: AppState.prefersDarkMode }
    }));
}

// Charger les polices de manière asynchrone
function loadFonts() {
    if ('fonts' in document) {
        // Charger les polices de manière asynchrone
        const inter = new FontFace('Inter', 'url(/fonts/Inter.var.woff2) format("woff2")');
        
        Promise.all([
            inter.load()
        ]).then(fonts => {
            fonts.forEach(font => document.fonts.add(font));
            document.documentElement.classList.add('fonts-loaded');
        }).catch(error => {
            console.error('Erreur lors du chargement des polices:', error);
        });
    }
}

// Gérer le défilement
function handleScroll() {
    const currentScrollPos = window.pageYOffset;
    const header = document.querySelector('header');
    
    if (!header) return;
    
    // Gérer l'en-tête collant
    if (currentScrollPos > 100) {
        header.classList.add('scrolled');
        
        // Masquer/afficher l'en-tête lors du défilement
        if (currentScrollPos > AppState.scrollPosition && currentScrollPos > 200) {
            // Faire défiler vers le bas - masquer l'en-tête
            header.classList.add('hidden');
        } else {
            // Faire défiler vers le haut - afficher l'en-tête
            header.classList.remove('hidden');
        }
    } else {
        header.classList.remove('scrolled', 'hidden');
    }
    
    AppState.scrollPosition = currentScrollPos;
    
    // Mettre à jour la position de la barre de progression de défilement
    updateScrollProgress();
}

// Mettre à jour la barre de progression de défilement
function updateScrollProgress() {
    const scrollProgress = document.querySelector('.scroll-progress');
    
    if (!scrollProgress) return;
    
    const scrollTop = document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const progress = (scrollTop / scrollHeight) * 100;
    
    scrollProgress.style.width = `${progress}%`;
}

// Détecter si l'élément est dans le viewport
function isInViewport(element, offset = 0) {
    if (!element) return false;
    
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    
    return (
        rect.top <= (windowHeight - offset) &&
        rect.bottom >= offset
    );
}

// Initialiser l'application au chargement du DOM
document.addEventListener('DOMContentLoaded', init);

// Exposer des méthodes globales si nécessaire
window.App = {
    toggleDarkMode,
    scrollToElement,
    isInViewport,
    showNotification,
    state: AppState
};

// Exporter les modules principaux pour une utilisation externe
export {
    gsap,
    ScrollTrigger,
    initNavigation,
    initAnimations,
    initScrollEffects,
    initContactForm
};
