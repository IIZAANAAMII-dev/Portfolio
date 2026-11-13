import { site } from '@/data/site';

/**
 * Bouteille à la mer : envoi réel du formulaire de contact.
 *
 * Fournisseurs, par ordre de priorité (variables d'environnement, jamais dans le code) :
 *  - RESEND_API_KEY      → e-mail via l'API Resend (CONTACT_FROM_EMAIL, CONTACT_TO_EMAIL facultatifs) ;
 *  - CONTACT_WEBHOOK_URL → POST JSON vers un webhook (Formspree, Slack, Discord, n8n…).
 * Sans fournisseur configuré, la route répond 503 : le site ne prétend jamais avoir
 * envoyé un message qui n'est parti nulle part (le visiteur se voit proposer sa messagerie).
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recent = new Map<string, number[]>();

function rateLimited(key: string) {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    recent.set(key, hits);
    return true;
  }
  hits.push(now);
  recent.set(key, hits);
  if (recent.size > 2000) recent.clear();
  return false;
}

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function POST(request: Request) {
  let data: Record<string, unknown>;
  try {
    data = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: 'invalid' }, { status: 400 });
  }

  // Pot de miel : un humain ne remplit jamais ce champ invisible.
  if (text(data.website, 200)) return Response.json({ ok: true });

  const message = text(data.message, 5000);
  const name = text(data.name, 120);
  const email = text(data.email, 200);
  if (message.length < 2) return Response.json({ ok: false, error: 'empty' }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ ok: false, error: 'email' }, { status: 400 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (rateLimited(ip)) return Response.json({ ok: false, error: 'rate' }, { status: 429 });

  const subject = `Bouteille à la mer${name ? ` de ${name}` : ''}`;
  const body = [message, '', `— ${name || 'Anonyme'}${email ? ` <${email}>` : ''}`, 'Envoyé depuis le portfolio'].join('\n');

  const resendKey = process.env.RESEND_API_KEY;
  const webhook = process.env.CONTACT_WEBHOOK_URL;

  try {
    if (resendKey) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.CONTACT_FROM_EMAIL || 'Portfolio <onboarding@resend.dev>',
          to: [process.env.CONTACT_TO_EMAIL || site.email],
          subject,
          text: body,
          ...(email ? { reply_to: email } : {}),
        }),
      });
      if (!response.ok) return Response.json({ ok: false, error: 'provider' }, { status: 502 });
      return Response.json({ ok: true });
    }
    if (webhook) {
      const response = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        // `text` (Slack) et `content` (Discord) en plus des champs bruts (Formspree, n8n…).
        body: JSON.stringify({ name, email, message, subject, text: `${subject}\n\n${body}`, content: `${subject}\n\n${body}` }),
      });
      if (!response.ok) return Response.json({ ok: false, error: 'provider' }, { status: 502 });
      return Response.json({ ok: true });
    }
  } catch {
    return Response.json({ ok: false, error: 'provider' }, { status: 502 });
  }

  return Response.json({ ok: false, error: 'not-configured' }, { status: 503 });
}
