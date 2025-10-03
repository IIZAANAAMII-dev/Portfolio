/**
 * Configuration de l'application
 * Contient les constantes et paramètres globaux
 */

export const CONFIG = {
    // Paramètres de l'application
    APP_NAME: 'Portfolio Kyliann Le Garrec',
    APP_VERSION: '1.0.0',
    
    // Paramètres de l'API
    API_BASE_URL: 'https://api.example.com',
    API_ENDPOINTS: {
        CONTACT: '/contact',
        PROJECTS: '/projects',
        BLOG_POSTS: '/blog'
    },
    
    // Paramètres de l'interface
    UI: {
        // Délais d'animation (en millisecondes)
        ANIMATION_DELAYS: {
            SHORT: 100,
            MEDIUM: 300,
            LONG: 500,
            XLONG: 1000
        },
        
        // Points de rupture (breakpoints) pour le responsive
        BREAKPOINTS: {
            XS: 0,
            SM: 576,
            MD: 768,
            LG: 992,
            XL: 1200,
            XXL: 1400
        },
        
        // Paramètres de défilement
        SCROLL: {
            DURATION: 800,
            OFFSET: 80, // Décallage pour la navigation fixe
            EASING: 'easeInOutCubic'
        },
        
        // Paramètres du mode sombre
        DARK_MODE: {
            STORAGE_KEY: 'darkMode',
            CLASS_NAME: 'dark-mode',
            MEDIA_QUERY: '(prefers-color-scheme: dark)'
        },
        
        // Paramètres des notifications
        NOTIFICATIONS: {
            TIMEOUT: 5000, // Durée d'affichage en ms
            POSITION: 'top-right' // top-left, top-right, bottom-left, bottom-right
        }
    },
    
    // Paramètres du formulaire de contact
    CONTACT_FORM: {
        VALIDATION: {
            NAME_MIN_LENGTH: 2,
            EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            SUBJECT_MIN_LENGTH: 5,
            MESSAGE_MIN_LENGTH: 10
        },
        MESSAGES: {
            SUCCESS: 'Votre message a été envoyé avec succès !',
            ERROR: 'Une erreur est survenue. Veuillez réessayer plus tard.',
            VALIDATION: 'Veuillez corriger les erreurs dans le formulaire.'
        }
    },
    
    // Paramètres des médias sociaux
    SOCIAL_MEDIA: {
        GITHUB: 'https://github.com/username',
        LINKEDIN: 'https://linkedin.com/in/username',
        TWITTER: 'https://twitter.com/username',
        INSTAGRAM: 'https://instagram.com/username',
        DRIBBBLE: 'https://dribbble.com/username',
        BEHANCE: 'https://behance.net/username',
        MEDIUM: 'https://medium.com/@username',
        YOUTUBE: 'https://youtube.com/username',
        GITLAB: 'https://gitlab.com/username',
        CODEPEN: 'https://codepen.io/username',
        DEVTO: 'https://dev.to/username',
        STACK_OVERFLOW: 'https://stackoverflow.com/users/username',
        TWITCH: 'https://twitch.tv/username',
        DISCORD: 'https://discord.gg/username',
        SLACK: 'https://workspace.slack.com/team/username',
        SKYPE: 'skype:username?call',
        TELEGRAM: 'https://t.me/username',
        WHATSAPP: 'https://wa.me/1234567890',
        SIGNAL: 'https://signal.me/#p/+1234567890',
        KEYBASE: 'https://keybase.io/username',
        EMAIL: 'mailto:contact@example.com',
        PHONE: 'tel:+33123456789',
        RSS: '/rss.xml'
    },
    
    // Paramètres de suivi analytique
    ANALYTICS: {
        GOOGLE_ANALYTICS_ID: 'UA-XXXXXXXXX-X',
        FACEBOOK_PIXEL_ID: 'XXXXXXXXXXXXXXX',
        HOTJAR_ID: '1234567',
        MIXPANEL_TOKEN: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        AMPLITUDE_API_KEY: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        SEGMENT_WRITE_KEY: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        PLATFORM: 'web'
    },
    
    // Paramètres de performance
    PERFORMANCE: {
        // Activer le chargement paresseux des images
        LAZY_LOAD_IMAGES: true,
        
        // Activer le chargement paresseux des iframes
        LAZY_LOAD_IFRAMES: true,
        
        // Activer la préconnexion aux domaines externes
        PREFETCH_ENABLED: true,
        
        // Domaines à précharger
        PREFETCH_DOMAINS: [
            'https://fonts.googleapis.com',
            'https://fonts.gstatic.com',
            'https://cdnjs.cloudflare.com',
            'https://unpkg.com'
        ],
        
        // Activer le service worker
        SERVICE_WORKER_ENABLED: true,
        
        // Activer le cache HTTP
        HTTP_CACHE_ENABLED: true,
        
        // Temps de mise en cache (en secondes)
        CACHE_TTL: 86400 // 24 heures
    },
    
    // Paramètres de sécurité
    SECURITY: {
        // Activer la politique de sécurité du contenu (CSP)
        CSP_ENABLED: true,
        
        // Activer la protection contre le détournement de clics (clickjacking)
        CLICKJACKING_PROTECTION: true,
        
        // Activer la protection XSS (Cross-Site Scripting)
        XSS_PROTECTION: true,
        
        // Activer la protection contre le sniffing de type MIME
        NOSNIFF: true,
        
        // Activer la protection contre l'encodage de contenu
        NOSNIFF_HEADER: true,
        
        // Activer la protection contre l'encadrement (framing)
        FRAME_OPTIONS: 'SAMEORIGIN',
        
        // Activer la politique de référence (Referrer-Policy)
        REFERRER_POLICY: 'strict-origin-when-cross-origin',
        
        // Activer la politique de fonctionnalités
        FEATURE_POLICY: {
            'geolocation': 'none',
            'midi': 'none',
            'notifications': 'none',
            'push': 'none',
            'sync-xhr': 'self',
            'microphone': 'none',
            'camera': 'none',
            'magnetometer': 'none',
            'gyroscope': 'none',
            'speaker': 'self',
            'vibrate': 'none',
            'fullscreen': 'self',
            'payment': 'none'
        }
    },
    
    // Paramètres d'accessibilité
    ACCESSIBILITY: {
        // Activer la navigation au clavier
        KEYBOARD_NAVIGATION: true,
        
        // Activer le mode contraste élevé
        HIGH_CONTRAST_MODE: true,
        
        // Activer la navigation vocale
        SCREEN_READER_SUPPORT: true,
        
        // Activer les raccourcis clavier
        KEYBOARD_SHORTCUTS: {
            TOGGLE_DARK_MODE: ['Control', 'Alt', 'D'],
            SCROLL_TO_TOP: ['Home'],
            SCROLL_TO_BOTTOM: ['End'],
            NAVIGATE_HOME: ['h'],
            NAVIGATE_ABOUT: ['a'],
            NAVIGATE_PROJECTS: ['p'],
            NAVIGATE_CONTACT: ['c']
        }
    },
    
    // Paramètres d'internationalisation (i18n)
    I18N: {
        DEFAULT_LANGUAGE: 'fr',
        SUPPORTED_LANGUAGES: ['fr', 'en'],
        FALLBACK_LANGUAGE: 'fr',
        // Vous pouvez ajouter des traductions ici
        TRANSLATIONS: {
            fr: {
                // Traductions en français
            },
            en: {
                // Traductions en anglais
            }
        }
    },
    
    // Paramètres du thème
    THEME: {
        // Couleurs principales
        COLORS: {
            PRIMARY: '#6366f1',
            SECONDARY: '#8b5cf6',
            SUCCESS: '#10b981',
            DANGER: '#ef4444',
            WARNING: '#f59e0b',
            INFO: '#3b82f6',
            LIGHT: '#f9fafb',
            DARK: '#111827',
            WHITE: '#ffffff',
            BLACK: '#000000',
            GRAY: {
                50: '#f9fafb',
                100: '#f3f4f6',
                200: '#e5e7eb',
                300: '#d1d5db',
                400: '#9ca3af',
                500: '#6b7280',
                600: '#4b5563',
                700: '#374151',
                800: '#1f2937',
                900: '#111827'
            }
        },
        
        // Typographie
        TYPOGRAPHY: {
            FONT_FAMILY: {
                SANS: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                SERIF: 'Georgia, Cambria, "Times New Roman", Times, serif',
                MONO: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                DISPLAY: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                BODY: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
            },
            FONT_WEIGHT: {
                LIGHT: 300,
                NORMAL: 400,
                MEDIUM: 500,
                SEMIBOLD: 600,
                BOLD: 700,
                EXTRABOLD: 800,
                BLACK: 900
            },
            FONT_SIZE: {
                XS: '0.75rem',   // 12px
                SM: '0.875rem',  // 14px
                BASE: '1rem',    // 16px
                LG: '1.125rem',  // 18px
                XL: '1.25rem',   // 20px
                '2XL': '1.5rem', // 24px
                '3XL': '1.875rem', // 30px
                '4XL': '2.25rem',  // 36px
                '5XL': '3rem',     // 48px
                '6XL': '3.75rem',  // 60px
                '7XL': '4.5rem',   // 72px
                '8XL': '6rem',     // 96px
                '9XL': '8rem'      // 128px
            },
            LINE_HEIGHT: {
                NONE: 1,
                TIGHT: 1.25,
                SNUG: 1.375,
                NORMAL: 1.5,
                RELAXED: 1.625,
                LOOSE: 2
            },
            LETTER_SPACING: {
                TIGHTER: '-0.05em',
                TIGHT: '-0.025em',
                NORMAL: '0',
                WIDE: '0.025em',
                WIDER: '0.05em',
                WIDEST: '0.1em'
            }
        },
        
        // Espacement
        SPACING: {
            PX: '1px',
            0: '0',
            0.5: '0.125rem', // 2px
            1: '0.25rem',    // 4px
            1.5: '0.375rem', // 6px
            2: '0.5rem',     // 8px
            2.5: '0.625rem', // 10px
            3: '0.75rem',    // 12px
            3.5: '0.875rem', // 14px
            4: '1rem',       // 16px
            5: '1.25rem',    // 20px
            6: '1.5rem',     // 24px
            7: '1.75rem',    // 28px
            8: '2rem',       // 32px
            9: '2.25rem',    // 36px
            10: '2.5rem',    // 40px
            11: '2.75rem',   // 44px
            12: '3rem',      // 48px
            14: '3.5rem',    // 56px
            16: '4rem',      // 64px
            20: '5rem',      // 80px
            24: '6rem',      // 96px
            28: '7rem',      // 112px
            32: '8rem',      // 128px
            36: '9rem',      // 144px
            40: '10rem',     // 160px
            44: '11rem',     // 176px
            48: '12rem',     // 192px
            52: '13rem',     // 208px
            56: '14rem',     // 224px
            60: '15rem',     // 240px
            64: '16rem',     // 256px
            72: '18rem',     // 288px
            80: '20rem',     // 320px
            96: '24rem'      // 384px
        },
        
        // Bordures
        BORDER_RADIUS: {
            NONE: '0',
            SM: '0.125rem', // 2px
            DEFAULT: '0.25rem',  // 4px
            MD: '0.375rem',     // 6px
            LG: '0.5rem',       // 8px
            XL: '0.75rem',      // 12px
            '2XL': '1rem',      // 16px
            '3XL': '1.5rem',    // 24px
            FULL: '9999px'
        },
        
        // Ombres
        BOX_SHADOW: {
            SM: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            MD: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            LG: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            XL: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            '2XL': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            INNER: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
            NONE: 'none'
        },
        
        // Transitions
        TRANSITION: {
            DURATION: {
                DEFAULT: '150ms',
                75: '75ms',
                100: '100ms',
                150: '150ms',
                200: '200ms',
                300: '300ms',
                500: '500ms',
                700: '700ms',
                1000: '1000ms'
            },
            TIMING_FUNCTION: {
                LINEAR: 'linear',
                IN: 'cubic-bezier(0.4, 0, 1, 1)',
                OUT: 'cubic-bezier(0, 0, 0.2, 1)',
                IN_OUT: 'cubic-bezier(0.4, 0, 0.2, 1)'
            },
            PROPERTY: {
                NONE: 'none',
                ALL: 'all',
                DEFAULT: 'background-color, border-color, color, fill, stroke, opacity, box-shadow, transform',
                COLORS: 'background-color, border-color, color, fill, stroke',
                OPACITY: 'opacity',
                SHADOW: 'box-shadow',
                TRANSFORM: 'transform'
            },
            DELAY: {
                75: '75ms',
                100: '100ms',
                150: '150ms',
                200: '200ms',
                300: '300ms',
                500: '500ms',
                700: '700ms',
                1000: '1000ms'
            }
        },
        
        // Z-index
        Z_INDEX: {
            AUTO: 'auto',
            0: '0',
            10: '10',
            20: '20',
            30: '30',
            40: '40',
            50: '50',
            DROPDOWN: '1000',
            STICKY: '1020',
            FIXED: '1030',
            MODAL_BACKDROP: '1040',
            MODAL: '1050',
            POPOVER: '1060',
            TOOLTIP: '1070',
            NOTIFICATION: '1080',
            TOAST: '1090',
            DIALOG: '1100',
            LOADING: '9999'
        }
    }
};

// Configuration de GSAP
export const GSAP_CONFIG = {
    // Durées d'animation (en secondes)
    DURATION: {
        FAST: 0.3,
        NORMAL: 0.6,
        SLOW: 1,
        SLOWER: 1.5
    },
    
    // Fonctions d'accélération (easing)
    EASE: {
        // Easing standards
        NONE: 'none',
        POWER1_IN: 'power1.in',
        POWER1_OUT: 'power1.out',
        POWER1_IN_OUT: 'power1.inOut',
        POWER2_IN: 'power2.in',
        POWER2_OUT: 'power2.out',
        POWER2_IN_OUT: 'power2.inOut',
        POWER3_IN: 'power3.in',
        POWER3_OUT: 'power3.out',
        POWER3_IN_OUT: 'power3.inOut',
        POWER4_IN: 'power4.in',
        POWER4_OUT: 'power4.out',
        POWER4_IN_OUT: 'power4.inOut',
        
        // Easing personnalisées
        EASE_IN: 'easeIn',
        EASE_OUT: 'easeOut',
        EASE_IN_OUT: 'easeInOut',
        EASE_IN_BACK: 'back.in',
        EASE_OUT_BACK: 'back.out',
        EASE_IN_OUT_BACK: 'back.inOut',
        EASE_IN_ELASTIC: 'elastic.in',
        EASE_OUT_ELASTIC: 'elastic.out',
        EASE_IN_OUT_ELASTIC: 'elastic.inOut',
        EASE_IN_BOUNCE: 'bounce.in',
        EASE_OUT_BOUNCE: 'bounce.out',
        EASE_IN_OUT_BOUNCE: 'bounce.inOut',
        
        // Easing personnalisées (courbes de Bézier)
        CUSTOM_EASE: 'customEase',
        CUSTOM_WOBBLE: 'customWobble',
        CUSTOM_BOUNCE: 'customBounce'
    },
    
    // Configuration de ScrollTrigger
    SCROLL_TRIGGER: {
        // Délai entre les rafraîchissements (en secondes)
        REFRESH_INTERVAL: 0.02,
        
        // Seuil de déclenchement (en pixels)
        TRIGGER_OFFSET: 0,
        
        // Durée de la transition (en secondes)
        TRANSITION_DURATION: 0.5,
        
        // Délai avant l'activation (en secondes)
        ACTIVATION_DELAY: 0,
        
        // Délai avant la désactivation (en secondes)
        DEACTIVATION_DELAY: 0,
        
        // Activer/désactiver le débogage
        DEBUG: false
    },
    
    // Configuration des animations de texte
    TEXT: {
        // Délai entre chaque caractère (en secondes)
        CHAR_DELAY: 0.03,
        
        // Durée de l'animation de chaque caractère (en secondes)
        CHAR_DURATION: 0.5,
        
        // Délai entre chaque mot (en secondes)
        WORD_DELAY: 0.05,
        
        // Durée de l'animation de chaque mot (en secondes)
        WORD_DURATION: 0.8,
        
        // Délai entre chaque ligne (en secondes)
        LINE_DELAY: 0.1,
        
        // Durée de l'animation de chaque ligne (en secondes)
        LINE_DURATION: 1
    },
    
    // Configuration des animations de chargement
    LOADING: {
        // Durée de l'animation de chargement (en secondes)
        DURATION: 1.5,
        
        // Délai entre chaque élément (en secondes)
        ITEM_DELAY: 0.1,
        
        // Nombre d'éléments
        ITEM_COUNT: 3,
        
        // Couleur de l'animation
        COLOR: '#6366f1',
        
        // Taille de l'animation
        SIZE: 40
    }
};

// Configuration des animations de défilement
export const SCROLL_CONFIG = {
    // Durée de l'animation de défilement (en millisecondes)
    DURATION: 1000,
    
    // Délai avant le début de l'animation (en millisecondes)
    DELAY: 0,
    
    // Fonction d'accélération
    EASING: 'easeInOutQuart',
    
    // Décallage par rapport à la cible (en pixels)
    OFFSET: 0,
    
    // Désactiver l'animation sur les appareils mobiles
    DISABLE_ON_MOBILE: true,
    
    // Désactiver l'animation pour les utilisateurs qui préfèrent les réductions de mouvement
    RESPECT_REDUCED_MOTION: true
};

// Configuration des animations de curseur
export const CURSOR_CONFIG = {
    // Activer/désactiver le curseur personnalisé
    ENABLED: true,
    
    // Taille du curseur (en pixels)
    SIZE: 8,
    
    // Taille du curseur au survol (en pixels)
    HOVER_SIZE: 40,
    
    // Couleur du curseur
    COLOR: '#6366f1',
    
    // Opacité du curseur
    OPACITY: 1,
    
    // Délai de suivi (en secondes)
    DELAY: 0.1,
    
    // Inertie du curseur (0-1)
    INERTIA: 0.2,
    
    // Désactiver le curseur personnalisé sur les appareils mobiles
    DISABLE_ON_MOBILE: true
};

// Configuration des animations de chargement
export const LOADING_CONFIG = {
    // Activer/désactiver l'animation de chargement
    ENABLED: true,
    
    // Durée minimale d'affichage (en millisecondes)
    MINIMUM_DURATION: 1000,
    
    // Délai avant d'afficher l'animation (en millisecondes)
    DELAY: 200,
    
    // Type d'animation ('spinner', 'progress', 'skeleton', 'custom')
    TYPE: 'spinner',
    
    // Couleur de l'animation
    COLOR: '#6366f1',
    
    // Taille de l'animation (en pixels)
    SIZE: 40,
    
    // Couleur de fond
    BACKGROUND: 'rgba(255, 255, 255, 0.9)',
    
    // Afficher/masquer la barre de progression
    SHOW_PROGRESS: true,
    
    // Afficher/masquer le pourcentage
    SHOW_PERCENTAGE: true
};

// Configuration des animations de transition de page
export const PAGE_TRANSITION_CONFIG = {
    // Activer/désactiver les transitions de page
    ENABLED: true,
    
    // Durée de la transition d'entrée (en millisecondes)
    DURATION_IN: 500,
    
    // Durée de la transition de sortie (en millisecondes)
    DURATION_OUT: 300,
    
    // Délai entre les transitions (en millisecondes)
    DELAY: 100,
    
    // Fonction d'accélération pour l'entrée
    EASING_IN: 'power2.out',
    
    // Fonction d'accélération pour la sortie
    EASING_OUT: 'power2.in',
    
    // Type de transition ('fade', 'slide', 'scale', 'custom')
    TYPE: 'fade',
    
    // Direction de la transition ('left', 'right', 'up', 'down')
    DIRECTION: 'left',
    
    // Couleur de fond de la transition
    BACKGROUND: '#ffffff',
    
    // Afficher un indicateur de chargement pendant la transition
    SHOW_LOADER: true,
    
    // Désactiver les transitions sur les appareils mobiles
    DISABLE_ON_MOBILE: true
};

// Configuration des animations de défilement fluide
export const SMOOTH_SCROLL_CONFIG = {
    // Activer/désactiver le défilement fluide
    ENABLED: true,
    
    // Durée du défilement (en millisecondes)
    DURATION: 1000,
    
    // Délai avant le début du défilement (en millisecondes)
    DELAY: 0,
    
    // Fonction d'accélération
    EASING: 'easeInOutQuart',
    
    // Décallage par rapport à la cible (en pixels)
    OFFSET: 0,
    
    // Désactiver le défilement fluide sur les appareils mobiles
    DISABLE_ON_MOBILE: true,
    
    // Respecter la préférence de réduction de mouvement
    RESPECT_REDUCED_MOTION: true
};

// Configuration des animations de chargement paresseux
export const LAZY_LOAD_CONFIG = {
    // Activer/désactiver le chargement paresseux
    ENABLED: true,
    
    // Charger les images qui sont dans le viewport avec un décalage (en pixels)
    ROOT_MARGIN: '200px 0px',
    
    // Seuil de visibilité pour déclencher le chargement (0-1)
    THRESHOLD: 0.01,
    
    // Activer le chargement progressif des images
    PROGRESSIVE_LOADING: true,
    
    // Qualité des images de préchargement (0-1)
    PLACEHOLDER_QUALITY: 0.2,
    
    // Effet de transition lors du chargement
    TRANSITION_EFFECT: 'fade',
    
    // Durée de la transition (en millisecondes)
    TRANSITION_DURATION: 500,
    
    // Fonction d'accélération de la transition
    TRANSITION_EASING: 'ease-out',
    
    // Afficher un effet de flou pendant le chargement
    USE_BLUR: true,
    
    // Intensité du flou (en pixels)
    BLUR_AMOUNT: 10,
    
    // Couleur de fond du placeholder
    PLACEHOLDER_COLOR: '#f3f4f6',
    
    // Activer le chargement paresseux pour les iframes
    LAZY_LOAD_IFRAMES: true,
    
    // Désactiver le chargement paresseux pour les images au-dessus du pli
    ABOVE_THE_FOLD: false
};

// Configuration des animations de chargement des médias
export const MEDIA_LOADING_CONFIG = {
    // Activer/désactiver les animations de chargement des médias
    ENABLED: true,
    
    // Type d'animation ('spinner', 'progress', 'skeleton', 'custom')
    TYPE: 'spinner',
    
    // Couleur de l'animation
    COLOR: '#6366f1',
    
    // Taille de l'animation (en pixels)
    SIZE: 40,
    
    // Couleur de fond du placeholder
    PLACEHOLDER_COLOR: '#f3f4f6',
    
    // Afficher un effet de flou pendant le chargement
    USE_BLUR: true,
    
    // Intensité du flou (en pixels)
    BLUR_AMOUNT: 10,
    
    // Durée de la transition (en millisecondes)
    TRANSITION_DURATION: 500,
    
    // Fonction d'accélération de la transition
    TRANSITION_EASING: 'ease-out',
    
    // Afficher un effet de fondu à l'apparition
    FADE_IN: true,
    
    // Durée du fondu d'entrée (en millisecondes)
    FADE_IN_DURATION: 300,
    
    // Afficher un effet de fondu à la disparition
    FADE_OUT: true,
    
    // Durée du fondu de sortie (en millisecondes)
    FADE_OUT_DURATION: 200
};

// Configuration des animations de chargement des vidéos
export const VIDEO_LOADING_CONFIG = {
    // Activer/désactiver les animations de chargement des vidéos
    ENABLED: true,
    
    // Afficher un aperçu de la vidéo avant le chargement
    SHOW_PREVIEW: true,
    
    // Qualité de l'aperçu (0-1)
    PREVIEW_QUALITY: 0.1,
    
    // Afficher les contrôles de lecture
    SHOW_CONTROLS: true,
    
    // Lecture automatique
    AUTOPLAY: false,
    
    // Lecture en boucle
    LOOP: false,
    
    // Activer le mode silencieux
    MUTED: true,
    
    // Afficher l'image de prévisualisation
    SHOW_POSTER: true,
    
    // Afficher le bouton de lecture
    SHOW_PLAY_BUTTON: true,
    
    // Taille du bouton de lecture (en pixels)
    PLAY_BUTTON_SIZE: 80,
    
    // Couleur du bouton de lecture
    PLAY_BUTTON_COLOR: '#ffffff',
    
    // Opacité du bouton de lecture
    PLAY_BUTTON_OPACITY: 0.8,
    
    // Échelle du bouton de lecture au survol
    PLAY_BUTTON_HOVER_SCALE: 1.1,
    
    // Durée de l'animation du bouton (en millisecondes)
    PLAY_BUTTON_ANIMATION_DURATION: 200,
    
    // Afficher la barre de progression
    SHOW_PROGRESS: true,
    
    // Hauteur de la barre de progression (en pixels)
    PROGRESS_BAR_HEIGHT: 4,
    
    // Couleur de la barre de progression
    PROGRESS_BAR_COLOR: 'rgba(255, 255, 255, 0.5)',
    
    // Couleur de la barre de progression remplie
    PROGRESS_BAR_FILL_COLOR: '#6366f1',
    
    // Afficher le temps écoulé
    SHOW_TIME_ELAPSED: true,
    
    // Afficher la durée totale
    SHOW_DURATION: true,
    
    // Afficher le bouton de lecture/lecture
    SHOW_PLAY_PAUSE_BUTTON: true,
    
    // Afficher le bouton de volume
    SHOW_VOLUME_BUTTON: true,
    
    // Afficher le bouton plein écran
    SHOW_FULLSCREEN_BUTTON: true
};
