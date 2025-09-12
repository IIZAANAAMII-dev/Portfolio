// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// DOM Elements
const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');
const contactForm = document.getElementById('contact-form');

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initScrollAnimations();
    initHeroAnimations();
    initContactForm();
    initScrollEffects();
    
    // Initialize custom cursor on desktop only
    if (window.innerWidth > 768) {
        initCustomCursor();
    }
});

// Navigation functionality
function initNavigation() {
    // Mobile menu toggle
    navToggle.addEventListener('click', function() {
        navMenu.classList.toggle('active');
        navToggle.classList.toggle('active');
    });

    // Close mobile menu when clicking on a link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            hamburgerMenu.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!hamburgerMenu.contains(e.target) && !navMenu.contains(e.target)) {
            hamburgerMenu.classList.remove('active');
            navMenu.classList.remove('active');
        }
    });

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Navbar scroll effect
    window.addEventListener('scroll', function() {
        if (window.scrollY > 100) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
}

// Hero section GSAP animations
function initHeroAnimations() {
    const tl = gsap.timeline();

    // Animate hero content
    tl.to('.hero-content', {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'power3.out'
    })
    .to('.hero-image', {
        opacity: 1,
        scale: 1,
        duration: 1,
        ease: 'power3.out'
    }, '-=0.5')
    .to('.floating-card', {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.2,
        ease: 'power2.out'
    }, '-=0.3');

    // Floating animation for cards
    gsap.to('.card-1', {
        y: -20,
        duration: 3,
        repeat: -1,
        yoyo: true,
        ease: 'power2.inOut'
    });

    gsap.to('.card-2', {
        y: 15,
        duration: 2.5,
        repeat: -1,
        yoyo: true,
        ease: 'power2.inOut',
        delay: 0.5
    });

    gsap.to('.card-3', {
        y: -10,
        duration: 3.5,
        repeat: -1,
        yoyo: true,
        ease: 'power2.inOut',
        delay: 1
    });

    // Parallax effect for hero background
    gsap.to('.hero', {
        backgroundPosition: '50% 100px',
        ease: 'none',
        scrollTrigger: {
            trigger: '.hero',
            start: 'top bottom',
            end: 'bottom top',
            scrub: true
        }
    });
}

// Scroll-triggered animations
function initScrollAnimations() {
    // Fade in animations for sections
    gsap.utils.toArray('.fade-in').forEach(element => {
        gsap.fromTo(element, {
            opacity: 0,
            y: 50
        }, {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: element,
                start: 'top 80%',
                end: 'bottom 20%',
                toggleActions: 'play none none reverse'
            }
        });
    });

    // Slide in from left
    gsap.utils.toArray('.slide-in-left').forEach(element => {
        gsap.fromTo(element, {
            opacity: 0,
            x: -100
        }, {
            opacity: 1,
            x: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: element,
                start: 'top 80%',
                toggleActions: 'play none none reverse'
            }
        });
    });

    // Slide in from right
    gsap.utils.toArray('.slide-in-right').forEach(element => {
        gsap.fromTo(element, {
            opacity: 0,
            x: 100
        }, {
            opacity: 1,
            x: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: element,
                start: 'top 80%',
                toggleActions: 'play none none reverse'
            }
        });
    });

    // Scale in animations
    gsap.utils.toArray('.scale-in').forEach(element => {
        gsap.fromTo(element, {
            opacity: 0,
            scale: 0.8
        }, {
            opacity: 1,
            scale: 1,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: element,
                start: 'top 80%',
                toggleActions: 'play none none reverse'
            }
        });
    });

    // Project cards animation
    gsap.utils.toArray('.project-card').forEach((card, index) => {
        gsap.fromTo(card, {
            opacity: 0,
            y: 100,
            scale: 0.9
        }, {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: card,
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            },
            delay: index * 0.2
        });
    });

    // Skills animation
    gsap.utils.toArray('.skill-group').forEach((group, index) => {
        gsap.fromTo(group, {
            opacity: 0,
            y: 50
        }, {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: group,
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            },
            delay: index * 0.1
        });

        // Animate skill tags
        gsap.fromTo(group.querySelectorAll('.skill-tag'), {
            opacity: 0,
            scale: 0.8
        }, {
            opacity: 1,
            scale: 1,
            duration: 0.5,
            ease: 'power2.out',
            stagger: 0.05,
            scrollTrigger: {
                trigger: group,
                start: 'top 80%',
                toggleActions: 'play none none reverse'
            },
            delay: (index * 0.1) + 0.3
        });
    });

    // Process timeline animation
    gsap.utils.toArray('.process-step').forEach((step, index) => {
        const stepNumber = step.querySelector('.step-number');
        const stepContent = step.querySelector('.step-content');

        gsap.fromTo(stepNumber, {
            opacity: 0,
            scale: 0,
            rotation: -180
        }, {
            opacity: 1,
            scale: 1,
            rotation: 0,
            duration: 0.8,
            ease: 'back.out(1.7)',
            scrollTrigger: {
                trigger: step,
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            },
            delay: index * 0.2
        });

        gsap.fromTo(stepContent, {
            opacity: 0,
            y: 30
        }, {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: step,
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            },
            delay: (index * 0.2) + 0.3
        });
    });
}

// Additional scroll effects
function initScrollEffects() {
    // Parallax effect for section backgrounds
    gsap.utils.toArray('.about, .skills, .contact').forEach(section => {
        gsap.to(section, {
            yPercent: -50,
            ease: 'none',
            scrollTrigger: {
                trigger: section,
                start: 'top bottom',
                end: 'bottom top',
                scrub: true
            }
        });
    });

    // Text reveal animation for section titles
    gsap.utils.toArray('.section-title').forEach(title => {
        gsap.fromTo(title, {
            opacity: 0,
            y: 30,
            scale: 0.9
        }, {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: title,
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            }
        });
    });
}

// Contact form functionality
function initContactForm() {
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(contactForm);
            const name = formData.get('name');
            const email = formData.get('email');
            const message = formData.get('message');

            // Basic validation
            if (!name || !email || !message) {
                showNotification('Veuillez remplir tous les champs.', 'error');
                return;
            }

            if (!isValidEmail(email)) {
                showNotification('Veuillez entrer une adresse email valide.', 'error');
                return;
            }

            // Simulate form submission
            const submitButton = contactForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            
            submitButton.textContent = 'Envoi en cours...';
            submitButton.disabled = true;

            // Simulate API call
            setTimeout(() => {
                showNotification('Message envoyé avec succès ! Je vous répondrai bientôt.', 'success');
                contactForm.reset();
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }, 2000);
        });
    }
}

// Utility functions
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '15px 20px',
        borderRadius: '10px',
        color: 'white',
        fontWeight: '500',
        zIndex: '10000',
        transform: 'translateX(100%)',
        transition: 'transform 0.3s ease',
        maxWidth: '300px',
        wordWrap: 'break-word'
    });

    // Set background color based on type
    switch (type) {
        case 'success':
            notification.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
            break;
        case 'error':
            notification.style.background = 'linear-gradient(135deg, #f44336, #da190b)';
            break;
        default:
            notification.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
    }

    // Add to DOM
    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);

    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// Intersection Observer for fade-in effects (fallback for older browsers)
function initIntersectionObserver() {
    if ('IntersectionObserver' in window) {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, observerOptions);

        // Observe elements with animation classes
        document.querySelectorAll('.fade-in, .slide-in-left, .slide-in-right, .scale-in').forEach(el => {
            observer.observe(el);
        });
    }
}

// Mouse cursor effects (optional enhancement)
function initCursorEffects() {
    // disabled in favor of js/cursor.js
    return;
    const cursor = document.createElement('div');
    cursor.className = 'custom-cursor';
    cursor.style.cssText = `
        position: fixed;
        width: 20px;
        height: 20px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
        transform: translate(-50%, -50%);
        transition: transform 0.1s ease;
        opacity: 0;
    `;
    document.body.appendChild(cursor);

    document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
        cursor.style.opacity = '1';
    });

    document.addEventListener('mouseenter', () => {
        cursor.style.opacity = '1';
    });

    document.addEventListener('mouseleave', () => {
        cursor.style.opacity = '0';
    });

    // Scale cursor on hover over interactive elements
    document.querySelectorAll('a, button, .project-card').forEach(el => {
        el.addEventListener('mouseenter', () => {
            cursor.style.transform = 'translate(-50%, -50%) scale(1.5)';
        });
        
        el.addEventListener('mouseleave', () => {
            cursor.style.transform = 'translate(-50%, -50%) scale(1)';
        });
    });
}

// Performance optimization: Debounce scroll events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Cursor effects are handled in js/cursor.js
// if (window.innerWidth > 768) { initCursorEffects(); }

// Initialize intersection observer as fallback
initIntersectionObserver();

// Refresh ScrollTrigger on window resize
window.addEventListener('resize', debounce(() => {
    ScrollTrigger.refresh();
}, 250));
// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// Global Animation Controller
class GlobalAnimations {
    constructor() {
        this.init();
    }

    init() {
        this.setupGlobalScrollTriggers();
        this.setupPerformanceOptimizations();
    }

    setupGlobalScrollTriggers() {
        // Global scroll progress indicator
        gsap.to('.scroll-progress', {
            scaleX: 1,
            ease: "none",
            scrollTrigger: {
                trigger: document.body,
                start: "top top",
                end: "bottom bottom",
                scrub: true
            }
        });
    }

    setupPerformanceOptimizations() {
        // Refresh ScrollTrigger on resize
        window.addEventListener('resize', this.debounce(() => {
            ScrollTrigger.refresh();
        }, 250));
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize global animations when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    new GlobalAnimations();
});

// Navigation functionality
function initNavigation() {
    // Mobile menu toggle
    navToggle.addEventListener('click', function() {
        navMenu.classList.toggle('active');
        navToggle.classList.toggle('active');
    });

    // Close mobile menu when clicking on a link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            hamburgerMenu.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!hamburgerMenu.contains(e.target) && !navMenu.contains(e.target)) {
            hamburgerMenu.classList.remove('active');
            navMenu.classList.remove('active');
        }
    });

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Navbar scroll effect
    window.addEventListener('scroll', function() {
        if (window.scrollY > 100) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
}

// Hero section GSAP animations
function initHeroAnimations() {
    const tl = gsap.timeline();

    // Animate hero content
    tl.to('.hero-content', {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'power3.out'
    })
    .to('.hero-image', {
        opacity: 1,
        scale: 1,
        duration: 1,
        ease: 'power3.out'
    }, '-=0.5')
    .to('.floating-card', {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.2,
        ease: 'power2.out'
    }, '-=0.3');

    // Floating animation for cards
    gsap.to('.card-1', {
        y: -20,
        duration: 3,
        repeat: -1,
        yoyo: true,
        ease: 'power2.inOut'
    });

    gsap.to('.card-2', {
        y: 15,
        duration: 2.5,
        repeat: -1,
        yoyo: true,
        ease: 'power2.inOut',
        delay: 0.5
    });

    gsap.to('.card-3', {
        y: -10,
        duration: 3.5,
        repeat: -1,
        yoyo: true,
        ease: 'power2.inOut',
        delay: 1
    });

    // Parallax effect for hero background
    gsap.to('.hero', {
        backgroundPosition: '50% 100px',
        ease: 'none',
        scrollTrigger: {
            trigger: '.hero',
            start: 'top bottom',
            end: 'bottom top',
            scrub: true
        }
    });
}

// Scroll-triggered animations
function initScrollAnimations() {
    // Fade in animations for sections
    gsap.utils.toArray('.fade-in').forEach(element => {
        gsap.fromTo(element, {
            opacity: 0,
            y: 50
        }, {
            opacity: 1,
            y: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: element,
                start: 'top 80%',
                end: 'bottom 20%',
                toggleActions: 'play none none reverse'
            }
        });
    });

    // Slide in from left
    gsap.utils.toArray('.slide-in-left').forEach(element => {
        gsap.fromTo(element, {
            opacity: 0,
            x: -100
        }, {
            opacity: 1,
            x: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: element,
                start: 'top 80%',
                toggleActions: 'play none none reverse'
            }
        });
    });

    // Slide in from right
    gsap.utils.toArray('.slide-in-right').forEach(element => {
        gsap.fromTo(element, {
            opacity: 0,
            x: 100
        }, {
            opacity: 1,
            x: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: element,
                start: 'top 80%',
                toggleActions: 'play none none reverse'
            }
        });
    });

    // Scale in animations
    gsap.utils.toArray('.scale-in').forEach(element => {
        gsap.fromTo(element, {
            opacity: 0,
            scale: 0.8
        }, {
            opacity: 1,
            scale: 1,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: element,
                start: 'top 80%',
                toggleActions: 'play none none reverse'
            }
        });
    });

    // Project cards animation
    gsap.utils.toArray('.project-card').forEach((card, index) => {
        gsap.fromTo(card, {
            opacity: 0,
            y: 100,
            scale: 0.9
        }, {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: card,
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            },
            delay: index * 0.2
        });
    });

    // Skills animation
    gsap.utils.toArray('.skill-group').forEach((group, index) => {
        gsap.fromTo(group, {
            opacity: 0,
            y: 50
        }, {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: group,
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            },
            delay: index * 0.1
        });

        // Animate skill tags
        gsap.fromTo(group.querySelectorAll('.skill-tag'), {
            opacity: 0,
            scale: 0.8
        }, {
            opacity: 1,
            scale: 1,
            duration: 0.5,
            ease: 'power2.out',
            stagger: 0.05,
            scrollTrigger: {
                trigger: group,
                start: 'top 80%',
                toggleActions: 'play none none reverse'
            },
            delay: (index * 0.1) + 0.3
        });
    });

    // Process timeline animation
    gsap.utils.toArray('.process-step').forEach((step, index) => {
        const stepNumber = step.querySelector('.step-number');
        const stepContent = step.querySelector('.step-content');

        gsap.fromTo(stepNumber, {
            opacity: 0,
            scale: 0,
            rotation: -180
        }, {
            opacity: 1,
            scale: 1,
            rotation: 0,
            duration: 0.8,
            ease: 'back.out(1.7)',
            scrollTrigger: {
                trigger: step,
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            },
            delay: index * 0.2
        });

        gsap.fromTo(stepContent, {
            opacity: 0,
            y: 30
        }, {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: step,
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            },
            delay: (index * 0.2) + 0.3
        });
    });
}

// Additional scroll effects
function initScrollEffects() {
    // Parallax effect for section backgrounds
    gsap.utils.toArray('.about, .skills, .contact').forEach(section => {
        gsap.to(section, {
            yPercent: -50,
            ease: 'none',
            scrollTrigger: {
                trigger: section,
                start: 'top bottom',
                end: 'bottom top',
                scrub: true
            }
        });
    });

    // Text reveal animation for section titles
    gsap.utils.toArray('.section-title').forEach(title => {
        gsap.fromTo(title, {
            opacity: 0,
            y: 30,
            scale: 0.9
        }, {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: title,
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            }
        });
    });
}

// Contact form functionality
function initContactForm() {
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(contactForm);
            const name = formData.get('name');
            const email = formData.get('email');
            const message = formData.get('message');

            // Basic validation
            if (!name || !email || !message) {
                showNotification('Veuillez remplir tous les champs.', 'error');
                return;
            }

            if (!isValidEmail(email)) {
                showNotification('Veuillez entrer une adresse email valide.', 'error');
                return;
            }

            // Simulate form submission
            const submitButton = contactForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            
            submitButton.textContent = 'Envoi en cours...';
            submitButton.disabled = true;

            // Simulate API call
            setTimeout(() => {
                showNotification('Message envoyé avec succès ! Je vous répondrai bientôt.', 'success');
                contactForm.reset();
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }, 2000);
        });
    }
}

// Utility functions
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '15px 20px',
        borderRadius: '10px',
        color: 'white',
        fontWeight: '500',
        zIndex: '10000',
        transform: 'translateX(100%)',
        transition: 'transform 0.3s ease',
        maxWidth: '300px',
        wordWrap: 'break-word'
    });

    // Set background color based on type
    switch (type) {
        case 'success':
            notification.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
            break;
        case 'error':
            notification.style.background = 'linear-gradient(135deg, #f44336, #da190b)';
            break;
        default:
            notification.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
    }

    // Add to DOM
    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);

    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// Intersection Observer for fade-in effects (fallback for older browsers)
function initIntersectionObserver() {
    if ('IntersectionObserver' in window) {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, observerOptions);

        // Observe elements with animation classes
        document.querySelectorAll('.fade-in, .slide-in-left, .slide-in-right, .scale-in').forEach(el => {
            observer.observe(el);
        });
    }
}

// Mouse cursor effects (optional enhancement)
function initCursorEffects() {
    const cursor = document.createElement('div');
    cursor.className = 'custom-cursor';
    cursor.style.cssText = `
        position: fixed;
        width: 20px;
        height: 20px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
        transform: translate(-50%, -50%);
        transition: transform 0.1s ease;
        opacity: 0;
    `;
    document.body.appendChild(cursor);

    document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
        cursor.style.opacity = '1';
    });

    document.addEventListener('mouseenter', () => {
        cursor.style.opacity = '1';
    });

    document.addEventListener('mouseleave', () => {
        cursor.style.opacity = '0';
    });

    // Scale cursor on hover over interactive elements
    document.querySelectorAll('a, button, .project-card').forEach(el => {
        el.addEventListener('mouseenter', () => {
            cursor.style.transform = 'translate(-50%, -50%) scale(1.5)';
        });
        
        el.addEventListener('mouseleave', () => {
            cursor.style.transform = 'translate(-50%, -50%) scale(1)';
        });
    });
}

// Performance optimization: Debounce scroll events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize cursor effects on desktop only
if (window.innerWidth > 768) {
    initCursorEffects();
}

// Initialize intersection observer as fallback
initIntersectionObserver();

// Refresh ScrollTrigger on window resize
window.addEventListener('resize', debounce(() => {
    ScrollTrigger.refresh();
}, 250));
