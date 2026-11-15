/**
 * Route `/api/contact` du formulaire de contact (bouteille à la mer).
 *
 * Extension `.server.ts` : la route n'existe que si le site tourne avec un serveur
 * (`next dev`, Vercel…). L'export statique de GitHub Pages l'ignore (`pageExtensions`
 * dans next.config.ts) et le formulaire passe alors par la messagerie du visiteur.
 */
export { POST } from '@/lib/server/contact-route';
