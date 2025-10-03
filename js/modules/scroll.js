/**
 * Gestion des effets de défilement
 * Contient les animations liées au défilement de la page
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Enregistrer le plugin ScrollTrigger
gsap.registerPlugin(ScrollTrigger);

export function initScrollEffects() {
    // Initialiser les animations de défilement
    initScrollAnimations();
    
    // Initialiser les effets de parallaxe
    initParallaxEffects();
    
    // Initialiser le défilement fluide
    initSmoothScrolling();
    
    // Initialiser le chargement paresseux des images
    initLazyLoading();
    
    // Initialiser le bouton de retour en haut
    initBackToTop();
}

function initScrollAnimations() {
    // Animation des titres de section
    gsap.utils.toArray('.section-title').forEach(title => {
        gsap.fromTo(title,
            { opacity: 0, y: 30 },
            {
                opacity: 1,
                y: 0,
                duration: 0.8,
                scrollTrigger: {
                    trigger: title,
                    start: 'top 85%',
                    toggleActions: 'play none none none',
                    once: true
                }
            }
        );
    });
    
    // Animation des séparateurs de section
    gsap.utils.toArray('.section-divider').forEach(divider => {
        gsap.fromTo(divider,
            { scaleX: 0, transformOrigin: 'left center' },
            {
                scaleX: 1,
                duration: 1,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: divider,
                    start: 'top 80%',
                    toggleActions: 'play none none none',
                    once: true
                }
            }
        );
    });
    
    // Animation des cartes de compétences
    gsap.utils.toArray('.skill-category').forEach((card, i) => {
        gsap.fromTo(card,
            { opacity: 0, y: 30 },
            {
                opacity: 1,
                y: 0,
                duration: 0.6,
                delay: i * 0.1,
                scrollTrigger: {
                    trigger: card,
                    start: 'top 90%',
                    toggleActions: 'play none none none',
                    once: true
                }
            }
        );
    });
    
    // Animation des projets
    gsap.utils.toArray('.project-card').forEach((project, i) => {
        gsap.fromTo(project,
            { opacity: 0, y: 50 },
            {
                opacity: 1,
                y: 0,
                duration: 0.8,
                delay: i * 0.1,
                ease: 'back.out(1.2)',
                scrollTrigger: {
                    trigger: project,
                    start: 'top 90%',
                    toggleActions: 'play none none none',
                    once: true
                }
            }
        );
    });
    
    // Animation des éléments de contact
    gsap.utils.toArray('.contact-item').forEach((item, i) => {
        gsap.fromTo(item,
            { opacity: 0, x: -20 },
            {
                opacity: 1,
                x: 0,
                duration: 0.6,
                delay: i * 0.15,
                scrollTrigger: {
                    trigger: item,
                    start: 'top 90%',
                    toggleActions: 'play none none none',
                    once: true
                }
            }
        );
    });
}

function initParallaxEffects() {
    // Effet de parallaxe pour l'image de la section hero
    const heroImage = document.querySelector('.hero-image');
    if (heroImage) {
        gsap.to(heroImage, {
            y: 50,
            scrollTrigger: {
                trigger: heroImage,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 1
            }
        });
    }
    
    // Effet de parallaxe pour les éléments décoratifs
    const parallaxElements = document.querySelectorAll('.parallax');
    parallaxElements.forEach(el => {
        const depth = parseFloat(el.dataset.depth) || 0.1;
        
        gsap.to(el, {
            y: (i, target) => {
                const scrollY = window.scrollY;
                const elementTop = target.getBoundingClientRect().top + window.scrollY;
                const elementHeight = target.offsetHeight;
                const viewportHeight = window.innerHeight;
                
                // Calculer la position de l'élément par rapport au viewport
                const elementPosition = (scrollY + viewportHeight) - elementTop;
                const distance = (elementPosition - viewportHeight) * depth;
                
                // Limiter le déplacement pour éviter les effets trop extrêmes
                return Math.max(-elementHeight * 0.3, Math.min(elementHeight * 0.3, distance));
            },
            ease: 'none',
            scrollTrigger: {
                trigger: el,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 1
            }
        });
    });
    
    // Effet de parallaxe pour les arrière-plans
    const parallaxBgElements = document.querySelectorAll('.parallax-bg');
    parallaxBgElements.forEach(el => {
        const speed = parseFloat(el.dataset.speed) || 0.5;
        
        gsap.to(el, {
            backgroundPositionY: () => window.scrollY * speed + 'px',
            ease: 'none',
            scrollTrigger: {
                trigger: el,
                start: 'top bottom',
                end: 'bottom top',
                scrub: true
            }
        });
    });
}

function initSmoothScrolling() {
    // Désactiver le défilement fluide natif pour les appareils mobiles
    if ('scrollBehavior' in document.documentElement.style) {
        return; // Le navigateur prend en charge le défilement fluide natif
    }
    
    // Implémentation personnalisée du défilement fluide pour les navigateurs plus anciens
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const headerOffset = 80;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

function initLazyLoading() {
    // Chargement paresseux des images
    const lazyImages = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.getAttribute('data-src');
                    
                    if (src) {
                        img.src = src;
                        img.removeAttribute('data-src');
                        img.classList.add('loaded');
                        
                        // Animation de fondu pour les images chargées
                        gsap.fromTo(img,
                            { opacity: 0 },
                            { opacity: 1, duration: 0.6, ease: 'power2.out' }
                        );
                        
                        observer.unobserve(img);
                    }
                }
            });
        }, {
            rootMargin: '200px 0px',
            threshold: 0.01
        });
        
        lazyImages.forEach(img => imageObserver.observe(img));
    } else {
        // Fallback pour les navigateurs qui ne prennent pas en charge IntersectionObserver
        let lazyLoadThrottle;
        
        function lazyLoad() {
            if (lazyLoadThrottle) {
                clearTimeout(lazyLoadThrottle);
            }
            
            lazyLoadThrottle = setTimeout(() => {
                const scrollTop = window.pageYOffset;
                
                lazyImages.forEach(img => {
                    if (img.offsetTop < (window.innerHeight + scrollTop + 500)) {
                        const src = img.getAttribute('data-src');
                        if (src) {
                            img.src = src;
                            img.removeAttribute('data-src');
                            img.classList.add('loaded');
                            
                            gsap.fromTo(img,
                                { opacity: 0 },
                                { opacity: 1, duration: 0.6, ease: 'power2.out' }
                            );
                        }
                    }
                });
                
                if (lazyImages.length === 0) {
                    document.removeEventListener('scroll', lazyLoad);
                    window.removeEventListener('resize', lazyLoad);
                    window.removeEventListener('orientationChange', lazyLoad);
                }
            }, 20);
        }
        
        document.addEventListener('scroll', lazyLoad);
        window.addEventListener('resize', lazyLoad);
        window.addEventListener('orientationChange', lazyLoad);
        
        // Chargement initial
        lazyLoad();
    }
}

function initBackToTop() {
    const backToTopBtn = document.querySelector('.back-to-top');
    
    if (!backToTopBtn) return;
    
    // Afficher/masquer le bouton au défilement
    function toggleBackToTop() {
        if (window.scrollY > 300) {
            backToTopBtn.classList.add('show');
            
            // Animation d'entrée
            gsap.fromTo(backToTopBtn,
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
            );
        } else {
            // Animation de sortie
            gsap.to(backToTopBtn, {
                opacity: 0,
                y: 20,
                duration: 0.3,
                ease: 'power2.in',
                onComplete: () => backToTopBtn.classList.remove('show')
            });
        }
    }
    
    // Gérer le clic sur le bouton
    backToTopBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        gsap.to(window, {
            scrollTo: 0,
            duration: 1,
            ease: 'power2.inOut'
        });
    });
    
    // Écouter l'événement de défilement
    window.addEventListener('scroll', toggleBackToTop);
    
    // Initialiser l'état du bouton
    toggleBackToTop();
}
