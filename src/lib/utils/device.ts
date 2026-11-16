/**
 * Sondes de l'appareil, toutes défensives : une API absente (vieux navigateur, mode privé,
 * WebView) ne fait jamais échouer la page, elle renvoie une valeur neutre.
 */

/** Carte graphique telle que WebGL la décrit (chaîne non masquée quand le navigateur l'autorise). */
export interface GpuProbe {
  /** Contexte WebGL disponible. */
  webgl: boolean;
  webgl2: boolean;
  /** Ex. « ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 …) », « Adreno (TM) 610 », « Apple GPU ». */
  renderer: string;
  vendor: string;
  maxTextureSize: number;
}

let gpuProbe: GpuProbe | null = null;

/**
 * Une seule sonde par visite : un petit contexte WebGL, interrogé puis rendu aussitôt
 * (WEBGL_lose_context) pour ne pas occuper l'un des rares contextes du navigateur.
 */
export function probeGpu(): GpuProbe {
  if (gpuProbe) return gpuProbe;
  const result: GpuProbe = { webgl: false, webgl2: false, renderer: '', vendor: '', maxTextureSize: 0 };
  if (typeof document === 'undefined') return result;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
      if (gl) result.webgl2 = true;
    } catch {
      gl = null;
    }
    if (!gl) {
      try {
        gl = (canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
      } catch {
        gl = null;
      }
    }
    if (gl) {
      result.webgl = true;
      try {
        // Firefox donne déjà la vraie carte dans RENDERER (et déconseille l'extension) ;
        // Chrome et Safari y mettent « WebKit WebGL » : l'extension donne alors le nom réel.
        let renderer: unknown = gl.getParameter(gl.RENDERER);
        let vendor: unknown = gl.getParameter(gl.VENDOR);
        if (typeof renderer !== 'string' || /^(webkit webgl|mozilla)?$/i.test(renderer.trim())) {
          const debug = gl.getExtension('WEBGL_debug_renderer_info');
          if (debug) {
            renderer = gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);
            vendor = gl.getParameter(debug.UNMASKED_VENDOR_WEBGL);
          }
        }
        result.renderer = typeof renderer === 'string' ? renderer : '';
        result.vendor = typeof vendor === 'string' ? vendor : '';
        const size = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        result.maxTextureSize = typeof size === 'number' ? size : 0;
      } catch {
        // Informations masquées : la classe de GPU restera « inconnue ».
      }
      try {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      } catch {
        // Le contexte sera libéré avec le canvas.
      }
    }
  } catch {
    // Pas de canvas utilisable : WebGL indisponible.
  }
  gpuProbe = result;
  return result;
}

export function supportsWebGL() {
  if (typeof window === 'undefined') return true;
  return probeGpu().webgl;
}

export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function isCoarsePointer() {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

/** Téléphone ou tablette (écran tactile, ou fenêtre étroite) : réglages graphiques allégés. */
export function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  return isCoarsePointer() || window.innerWidth < 820;
}

/** Cœurs logiques (0 si inconnu). */
export function cpuCores() {
  if (typeof navigator === 'undefined') return 0;
  const cores = Number(navigator.hardwareConcurrency);
  return Number.isFinite(cores) && cores > 0 ? cores : 0;
}

/** Mémoire vive approximative en Go (Chrome, Edge, Opera ; 0 si inconnue). */
export function deviceMemoryGb() {
  if (typeof navigator === 'undefined') return 0;
  const memory = Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory);
  return Number.isFinite(memory) && memory > 0 ? memory : 0;
}

/** Mode « économie de données » demandé par le visiteur. */
export function prefersSaveData() {
  if (typeof navigator === 'undefined') return false;
  try {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return true;
  } catch {
    // API absente.
  }
  try {
    return window.matchMedia('(prefers-reduced-data: reduce)').matches;
  } catch {
    return false;
  }
}

/** Pixels physiques de la fenêtre (taille CSS × densité de l'écran). */
export function viewportDevicePixels() {
  if (typeof window === 'undefined') return 0;
  const ratio = window.devicePixelRatio || 1;
  return Math.max(1, window.innerWidth) * Math.max(1, window.innerHeight) * ratio * ratio;
}
