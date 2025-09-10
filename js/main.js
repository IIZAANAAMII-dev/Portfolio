// Animation de la navbar au défilement
const enTete = document.querySelector('.en-tete');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        enTete.classList.add('defile');
    } else {
        enTete.classList.remove('defile');
    }
});

// Initialisation de GSAP
const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

tl.from('.logo', { y: -50, opacity: 0, duration: 0.5 })
  .from('.liens-navigation li', { y: -50, opacity: 0, stagger: 0.1, duration: 0.5 }, '-=0.25')
  .from('.bouton-cta', { y: 50, opacity: 0, duration: 0.5 }, '-=0.5')
  .from('.contenu-accueil h1', { y: 50, opacity: 0, duration: 0.5 })
  .from('.contenu-accueil h2', { y: 30, opacity: 0, duration: 0.5 }, '-=0.25')
  .from('.contenu-accueil p', { y: 30, opacity: 0, duration: 0.5 }, '-=0.25')
  .from('.contenu-accueil .bouton-cta', { y: 30, opacity: 0, duration: 0.5 }, '-=0.25');

// Animation des sections au défilement
const sections = document.querySelectorAll('section');

sections.forEach(section => {
    gsap.from(section, {
        scrollTrigger: {
            trigger: section,
            start: 'top 80%',
            toggleActions: 'play none none none'
        },
        y: 50,
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out'
    });
});

// Filtrage des projets
document.addEventListener('DOMContentLoaded', () => {
    const boutonsFiltres = document.querySelectorAll('.bouton-filtre');
    const cartesProjets = document.querySelectorAll('.carte-projet');
    
    boutonsFiltres.forEach(bouton => {
        bouton.addEventListener('click', () => {
            // Retire la classe active de tous les boutons
            boutonsFiltres.forEach(btn => btn.classList.remove('actif'));
            // Ajoute la classe active au bouton cliqué
            bouton.classList.add('actif');
            
            const filtre = bouton.getAttribute('data-filtre');
            
            cartesProjets.forEach(carte => {
                const categorie = carte.getAttribute('data-categorie');
                
                if (filtre === 'tous' || categorie === filtre) {
                    gsap.to(carte, {
                        display: 'block',
                        opacity: 1,
                        y: 0,
                        duration: 0.5,
                        ease: 'power2.out'
                    });
                } else {
                    gsap.to(carte, {
                        display: 'none',
                        opacity: 0,
                        y: 20,
                        duration: 0.3,
                        ease: 'power2.in'
                    });
                }
            });
        });
    });
});

// Animation des compétences
function animerCompetences() {
    const competences = document.querySelectorAll('.progression-competence');
    
    competences.forEach(competence => {
        const largeur = competence.style.width;
        competence.style.width = '0';
        
        gsap.to(competence, {
            width: largeur,
            duration: 1.5,
            ease: 'power2.out',
            scrollTrigger: {
                trigger: competence,
                start: 'top 80%',
                toggleActions: 'play none none none'
            }
        });
    });
}

// Appel de la fonction d'animation des compétences
animerCompetences();

// Animation des cartes de projet au survol
document.querySelectorAll('.carte-projet').forEach(carte => {
    carte.addEventListener('mouseenter', () => {
        gsap.to(carte, {
            scale: 1.03,
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
            duration: 0.3
        });
    });
    
    carte.addEventListener('mouseleave', () => {
        gsap.to(carte, {
            scale: 1,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            duration: 0.3
        });
    });
});

// Animation du formulaire de contact
const champsFormulaire = document.querySelectorAll('.groupe-formulaire input, .groupe-formulaire textarea');

champsFormulaire.forEach(champ => {
    champ.addEventListener('focus', () => {
        gsap.to(champ, {
            borderColor: 'var(--couleur-principale)',
            boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)',
            duration: 0.3
        });
    });
    
    champ.addEventListener('blur', () => {
        gsap.to(champ, {
            borderColor: 'var(--gris-clair)',
            boxShadow: 'none',
            duration: 0.3
        });
    });
});

// Animation des liens de navigation au survol
document.querySelectorAll('.liens-navigation a').forEach(lien => {
    lien.addEventListener('mouseenter', () => {
        gsap.to(lien, {
            color: 'var(--couleur-principale)',
            duration: 0.3
        });
    });
    
    lien.addEventListener('mouseleave', () => {
        gsap.to(lien, {
            color: 'var(--couleur-foncee)',
            duration: 0.3
        });
    });
});

// Animation des boutons de filtre au survol
document.querySelectorAll('.bouton-filtre').forEach(bouton => {
    bouton.addEventListener('mouseenter', () => {
        if (!bouton.classList.contains('actif')) {
            gsap.to(bouton, {
                backgroundColor: 'var(--couleur-principale)',
                color: 'white',
                duration: 0.3
            });
        }
    });
    
    bouton.addEventListener('mouseleave', () => {
        if (!bouton.classList.contains('actif')) {
            gsap.to(bouton, {
                backgroundColor: 'transparent',
                color: 'var(--couleur-principale)',
                duration: 0.3
            });
        }
    });
});

// Animation du chargement initial
document.addEventListener('DOMContentLoaded', () => {
    gsap.to('body', {
        opacity: 1,
        duration: 0.5
    });
});

// Gestion du formulaire de contact
const formulaire = document.querySelector('.formulaire-contact');
if (formulaire) {
    formulaire.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Animation de soumission
        gsap.to('.bouton-cta[type="submit"]', {
            backgroundColor: '#10b981',
            duration: 0.3
        });
        
        // Simulation d'envoi
        setTimeout(() => {
            alert('Message envoyé avec succès ! Je vous recontacterai bientôt.');
            formulaire.reset();
            
            gsap.to('.bouton-cta[type="submit"]', {
                backgroundColor: 'var(--couleur-principale)',
                duration: 0.3
            });
        }, 1000);
    });
}
