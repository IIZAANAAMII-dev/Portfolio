document.addEventListener('DOMContentLoaded', () => {

    // --- Sélecteurs ---
    const header = document.querySelector('.header');
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const navLinkItems = document.querySelectorAll('.nav-links li a');

    // --- Header shrink au scroll ---
    const onScroll = () => {
        if (window.scrollY > 10) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
    };
    window.addEventListener('scroll', onScroll);
    onScroll();

    // --- Menu mobile overlay avec ARIA ---
    const toggleMenu = () => {
        const open = navLinks.classList.toggle('active');
        menuToggle.classList.toggle('active', open);
        menuToggle.setAttribute('aria-expanded', String(open));
        if (open) {
            // Animation des liens du menu overlay
            gsap.fromTo('.nav-links a',
                { y: 8, opacity: 0 },
                { y: 0, opacity: 1, stagger: 0.06, duration: 0.35, ease: 'power2.out' }
            );
        }
    };
    if (menuToggle) menuToggle.addEventListener('click', toggleMenu);

    // Fermer le menu après clic sur un lien (mobile)
    navLinkItems.forEach(a => a.addEventListener('click', () => {
        if (getComputedStyle(menuToggle).display !== 'none' && navLinks.classList.contains('active')) {
            toggleMenu();
        }
    }));

    // --- Smooth scroll pour ancres ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const id = anchor.getAttribute('href');
            const target = document.querySelector(id);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // --- Animations GSAP ---
    gsap.registerPlugin(ScrollTrigger);

    // Apparition du header et des éléments de nav
    const navTl = gsap.timeline({ defaults: { ease: 'power3.out' }});
    navTl
        .from('.header', { y: -80, opacity: 0, duration: 0.6 })
        .from('.navbar .logo', { y: -10, opacity: 0, duration: 0.4 }, '-=0.2')
        .from('.navbar .nav-links li', { y: -8, opacity: 0, duration: 0.3, stagger: 0.05 }, '-=0.2')
        .from('.navbar .nav-cta', { y: -8, opacity: 0, duration: 0.3 }, '-=0.25');

    // Animation de la section Héro
    gsap.from('.hero-text > *', {
        y: 30,
        opacity: 0,
        stagger: 0.15,
        duration: 0.8,
        ease: 'power3.out'
    });

    // Apparition des badges de compétences
    gsap.from('.hero-badges li', {
        y: 12,
        opacity: 0,
        stagger: 0.08,
        duration: 0.5,
        ease: 'power2.out',
        delay: 0.2
    });

    // Flottement subtil du blob décoratif
    gsap.to('.hero-blob', {
        y: 16,
        scale: 1.02,
        duration: 4,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1
    });

    // Parallax léger au scroll pour le blob
    gsap.to('.hero-blob', {
        yPercent: 10,
        ease: 'none',
        scrollTrigger: {
            trigger: '.hero',
            start: 'top top',
            end: 'bottom top',
            scrub: 0.6
        }
    });

    // Reveal des cartes projets
    gsap.from('.project-card', {
        scrollTrigger: {
            trigger: '.projects-grid',
            start: 'top 85%',
            toggleActions: 'play none none none'
        },
        y: 30,
        opacity: 0,
        duration: 0.6,
        stagger: 0.15,
        ease: 'power2.out'
    });

    // Reveal générique des autres sections
    const sections = document.querySelectorAll('section:not(.hero)');
    sections.forEach(section => {
        gsap.from(section, {
            scrollTrigger: {
                trigger: section,
                start: 'top 80%',
                toggleActions: 'play none none none',
            },
            y: 40,
            opacity: 0,
            duration: 0.8,
            ease: 'power3.out'
        });
    });

});

