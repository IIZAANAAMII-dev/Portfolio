/**
 * Gestion du formulaire de contact
 * Contient la logique de validation et d'envoi du formulaire
 */

import { gsap } from 'gsap';

export function initContactForm() {
    const contactForm = document.getElementById('contactForm');
    
    if (!contactForm) return;
    
    const formStatus = document.createElement('div');
    formStatus.className = 'form-status';
    contactForm.insertBefore(formStatus, contactForm.firstChild);
    
    // Champs du formulaire
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const subjectInput = document.getElementById('subject');
    const messageInput = document.getElementById('message');
    const submitBtn = document.getElementById('submitBtn');
    
    // Validation en temps réel
    if (nameInput) nameInput.addEventListener('input', validateName);
    if (emailInput) emailInput.addEventListener('input', validateEmail);
    if (subjectInput) subjectInput.addEventListener('input', validateSubject);
    if (messageInput) messageInput.addEventListener('input', validateMessage);
    
    // Soumission du formulaire
    contactForm.addEventListener('submit', handleSubmit);
    
    // Fonctions de validation
    function validateName() {
        const name = nameInput.value.trim();
        const isValid = name.length >= 2;
        
        setFieldValidity(nameInput, isValid, 'Le nom doit contenir au moins 2 caractères');
        return isValid;
    }
    
    function validateEmail() {
        const email = emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const isValid = emailRegex.test(email);
        
        setFieldValidity(emailInput, isValid, 'Veuillez entrer une adresse email valide');
        return isValid;
    }
    
    function validateSubject() {
        const subject = subjectInput.value.trim();
        const isValid = subject.length >= 5;
        
        setFieldValidity(subjectInput, isValid, 'Le sujet doit contenir au moins 5 caractères');
        return isValid;
    }
    
    function validateMessage() {
        const message = messageInput.value.trim();
        const isValid = message.length >= 10;
        
        setFieldValidity(messageInput, isValid, 'Le message doit contenir au moins 10 caractères');
        return isValid;
    }
    
    function setFieldValidity(input, isValid, message) {
        const fieldContainer = input.closest('.form-group');
        
        if (!fieldContainer) return;
        
        // Supprimer les messages d'erreur existants
        const existingError = fieldContainer.querySelector('.error-message');
        if (existingError) {
            fieldContainer.removeChild(existingError);
        }
        
        // Mettre à jour les classes CSS
        if (isValid) {
            fieldContainer.classList.remove('error');
            fieldContainer.classList.add('success');
        } else if (input.value.trim() !== '') {
            // Afficher l'erreur uniquement si le champ n'est pas vide
            fieldContainer.classList.add('error');
            fieldContainer.classList.remove('success');
            
            // Ajouter le message d'erreur
            const errorElement = document.createElement('div');
            errorElement.className = 'error-message';
            errorElement.textContent = message;
            fieldContainer.appendChild(errorElement);
            
            // Animation du message d'erreur
            gsap.fromTo(errorElement,
                { opacity: 0, y: -10 },
                { opacity: 1, y: 0, duration: 0.3 }
            );
        } else {
            fieldContainer.classList.remove('error', 'success');
        }
    }
    
    // Gestion de la soumission du formulaire
    async function handleSubmit(e) {
        e.preventDefault();
        
        // Valider tous les champs
        const isNameValid = validateName();
        const isEmailValid = validateEmail();
        const isSubjectValid = subjectInput ? validateSubject() : true;
        const isMessageValid = validateMessage();
        
        if (!isNameValid || !isEmailValid || !isSubjectValid || !isMessageValid) {
            showFormStatus('Veuillez corriger les erreurs dans le formulaire', 'error');
            return;
        }
        
        // Désactiver le bouton de soumission
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Envoi en cours...';
        }
        
        // Afficher le statut de chargement
        showFormStatus('Envoi du message...', 'sending');
        
        try {
            // Récupérer les données du formulaire
            const formData = new FormData(contactForm);
            
            // Ici, vous devriez remplacer cette URL par l'URL de votre point de terminaison d'API
            const response = await fetch('https://example.com/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: formData.get('name'),
                    email: formData.get('email'),
                    subject: formData.get('subject'),
                    message: formData.get('message')
                })
            });
            
            if (response.ok) {
                // Réussite de l'envoi
                showFormStatus('Message envoyé avec succès ! Je vous répondrai dès que possible.', 'success');
                contactForm.reset();
                
                // Réinitialiser les états des champs
                document.querySelectorAll('.form-group').forEach(group => {
                    group.classList.remove('success');
                });
            } else {
                // Erreur côté serveur
                const errorData = await response.json();
                throw new Error(errorData.message || 'Une erreur est survenue lors de l\'envoi du message.');
            }
        } catch (error) {
            // Erreur réseau ou autre erreur
            console.error('Erreur lors de l\'envoi du formulaire:', error);
            showFormStatus(error.message || 'Une erreur est survenue. Veuillez réessayer plus tard.', 'error');
        } finally {
            // Réactiver le bouton de soumission
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Envoyer le message';
            }
        }
    }
    
    // Afficher le statut du formulaire
    function showFormStatus(message, type) {
        formStatus.textContent = message;
        formStatus.className = 'form-status';
        
        // Supprimer toutes les classes existantes
        formStatus.classList.remove('success', 'error', 'sending');
        
        // Ajouter la classe appropriée
        if (type === 'success' || type === 'error' || type === 'sending') {
            formStatus.classList.add(type);
        }
        
        // Animation d'entrée
        gsap.fromTo(formStatus,
            { opacity: 0, y: -10 },
            { opacity: 1, y: 0, duration: 0.3 }
        );
        
        // Masquer automatiquement après 5 secondes (sauf pour les erreurs)
        if (type !== 'error') {
            setTimeout(() => {
                gsap.to(formStatus, {
                    opacity: 0,
                    y: -10,
                    duration: 0.3,
                    onComplete: () => formStatus.textContent = ''
                });
            }, 5000);
        }
    }
    
    // Animation des champs du formulaire au chargement
    gsap.utils.toArray('.form-group').forEach((field, i) => {
        gsap.fromTo(field,
            { opacity: 0, y: 20 },
            {
                opacity: 1,
                y: 0,
                duration: 0.5,
                delay: 0.1 * i,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: field,
                    start: 'top 90%',
                    toggleActions: 'play none none none',
                    once: true
                }
            }
        );
    });
    
    // Animation du bouton de soumission
    if (submitBtn) {
        gsap.fromTo(submitBtn,
            { opacity: 0, y: 20 },
            {
                opacity: 1,
                y: 0,
                duration: 0.5,
                delay: 0.3,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: submitBtn,
                    start: 'top 90%',
                    toggleActions: 'play none none none',
                    once: true
                }
            }
        );
    }
    
    // Effet de survol pour les champs du formulaire
    const formInputs = contactForm.querySelectorAll('input, textarea');
    
    formInputs.forEach(input => {
        const fieldContainer = input.closest('.form-group');
        
        if (!fieldContainer) return;
        
        input.addEventListener('focus', () => {
            fieldContainer.classList.add('focused');
        });
        
        input.addEventListener('blur', () => {
            fieldContainer.classList.remove('focused');
        });
    });
}
