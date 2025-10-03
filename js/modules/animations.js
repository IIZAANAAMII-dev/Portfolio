/**
 * Gestion des animations de la page
 * Contient les animations GSAP et les effets de la section hero
 */

export function initHeroAnimations() {
    // Animation de la section hero
    const heroTitle = document.querySelector('.hero-title');
    const heroSubtitle = document.querySelector('.hero-subtitle');
    const heroCta = document.querySelector('.hero-cta');
    const heroImage = document.querySelector('.hero-image');
    const socialLinks = document.querySelector('.social-links');
    
    // Vérifier si les éléments existent avant d'animer
    if (!heroTitle || !heroSubtitle || !heroCta || !heroImage) return;
    
    // Réinitialiser les styles pour l'animation
    gsap.set([heroTitle, heroSubtitle, heroCta, heroImage, socialLinks], { opacity: 0, y: 20 });
    
    // Timeline principale
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    
    // Animation du titre
    tl.to(heroTitle, {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'power3.out'
    });
    
    // Animation du sous-titre
    tl.to(heroSubtitle, {
        opacity: 1,
        y: 0,
        duration: 0.8
    }, '-=0.6');
    
    // Animation du CTA
    tl.to(heroCta, {
        opacity: 1,
        y: 0,
        duration: 0.8
    }, '-=0.4');
    
    // Animation de l'image
    tl.to(heroImage, {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'back.out(1.4)'
    }, '-=0.8');
    
    // Animation des liens sociaux
    if (socialLinks) {
        tl.to(socialLinks, {
            opacity: 1,
            y: 0,
            duration: 0.8
        }, '-=0.6');
    }
    
    // Animation des éléments décoratifs
    const shapes = document.querySelectorAll('.shape');
    if (shapes.length > 0) {
        gsap.to(shapes, {
            y: '+=10',
            duration: 3,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut'
        });
    }
}

// Animation des éléments au défilement
export function initScrollAnimations() {
    // Animation des sections
    const sections = document.querySelectorAll('section');
    
    sections.forEach(section => {
        gsap.fromTo(section,
            { opacity: 0, y: 50 },
            {
                opacity: 1,
                y: 0,
                duration: 1,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: section,
                    start: 'top 85%',
                    toggleActions: 'play none none none',
                    once: true
                }
            }
        );
    });
    
    // Animation des compétences
    const skills = document.querySelectorAll('.skill-item');
    skills.forEach((skill, index) => {
        gsap.fromTo(skill,
            { opacity: 0, x: -20 },
            {
                opacity: 1,
                x: 0,
                duration: 0.5,
                delay: index * 0.1,
                scrollTrigger: {
                    trigger: skill,
                    start: 'top 90%',
                    toggleActions: 'play none none none',
                    once: true
                }
            }
        );
    });
    
    // Animation des projets
    const projects = document.querySelectorAll('.project-card');
    projects.forEach((project, index) => {
        gsap.fromTo(project,
            { opacity: 0, y: 50 },
            {
                opacity: 1,
                y: 0,
                duration: 0.6,
                delay: index * 0.1,
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
}

// Animation des éléments au survol
export function initHoverAnimations() {
    // Boutons
    const buttons = document.querySelectorAll('.btn, .nav-link');
    
    buttons.forEach(button => {
        button.addEventListener('mouseenter', () => {
            gsap.to(button, {
                scale: 1.05,
                duration: 0.3,
                ease: 'power2.out'
            });
        });
        
        button.addEventListener('mouseleave', () => {
            gsap.to(button, {
                scale: 1,
                duration: 0.3,
                ease: 'power2.out'
            });
        });
    });
    
    // Cartes de projet
    const projectCards = document.querySelectorAll('.project-card');
    
    projectCards.forEach(card => {
        const image = card.querySelector('img');
        const overlay = card.querySelector('.project-overlay');
        
        card.addEventListener('mouseenter', () => {
            gsap.to(image, {
                scale: 1.05,
                duration: 0.5,
                ease: 'power2.out'
            });
            
            if (overlay) {
                gsap.to(overlay, {
                    opacity: 1,
                    duration: 0.3,
                    ease: 'power2.out'
                });
            }
        });
        
        card.addEventListener('mouseleave', () => {
            gsap.to(image, {
                scale: 1,
                duration: 0.5,
                ease: 'power2.out'
            });
            
            if (overlay) {
                gsap.to(overlay, {
                    opacity: 0,
                    duration: 0.3,
                    ease: 'power2.out'
                });
            }
        });
    });
}

// Animation du curseur personnalisé (optionnel)
export function initCustomCursor() {
    if (window.innerWidth > 1024) {
        const cursor = document.createElement('div');
        const cursorFollower = document.createElement('div');
        
        cursor.classList.add('cursor');
        cursorFollower.classList.add('cursor-follower');
        
        document.body.appendChild(cursor);
        document.body.appendChild(cursorFollower);
        
        let posX = 0, posY = 0;
        let mouseX = 0, mouseY = 0;
        
        gsap.to({}, 0.01, {
            repeat: -1,
            onRepeat: () => {
                posX += (mouseX - posX) / 5;
                posY += (mouseY - posY) / 5;
                
                gsap.set(cursor, {
                    css: {
                        left: mouseX,
                        top: mouseY
                    }
                });
                
                gsap.set(cursorFollower, {
                    css: {
                        left: posX - 12,
                        top: posY - 12
                    }
                });
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });
        
        // Changer l'apparence du curseur au survol des éléments cliquables
        const hoverElements = [
            'a', 'button', 'input', 'textarea', 'select',
            '.btn', '.project-card', '.nav-link', '.social-link'
        ];
        
        hoverElements.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                el.addEventListener('mouseenter', () => {
                    cursor.classList.add('cursor-hover');
                    cursorFollower.classList.add('cursor-follower-hover');
                });
                
                el.addEventListener('mouseleave', () => {
                    cursor.classList.remove('cursor-hover');
                    cursorFollower.classList.remove('cursor-follower-hover');
                });
            });
        });
        
        // Ajouter des styles pour le curseur personnalisé
        const style = document.createElement('style');
        style.textContent = `
            .cursor {
                position: fixed;
                width: 8px;
                height: 8px;
                background-color: #6366f1;
                border-radius: 50%;
                pointer-events: none;
                z-index: 9999;
                transform: translate(-50%, -50%);
                transition: width 0.2s, height 0.2s, background-color 0.2s;
            }
            
            .cursor-hover {
                width: 40px;
                height: 40px;
                background-color: rgba(99, 102, 241, 0.2);
                backdrop-filter: blur(2px);
            }
            
            .cursor-follower {
                position: fixed;
                width: 24px;
                height: 24px;
                border: 2px solid #6366f1;
                border-radius: 50%;
                pointer-events: none;
                z-index: 9998;
                transform: translate(-50%, -50%);
                transition: width 0.3s, height 0.3s, border-color 0.3s;
            }
            
            .cursor-follower-hover {
                width: 60px;
                height: 60px;
                border-color: rgba(99, 102, 241, 0.5);
            }
            
            @media (hover: none) {
                .cursor,
                .cursor-follower {
                    display: none;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
}
