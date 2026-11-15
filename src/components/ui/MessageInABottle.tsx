'use client';

import { useState } from 'react';
import { site } from '@/data/site';
import { bottleThrow } from '@/components/world/MessageBottle';
import { logbook } from '@/lib/logbook';

/**
 * Adresse d'envoi direct, fixée à la construction du site (NEXT_PUBLIC_CONTACT_ENDPOINT) :
 * la route serveur `/api/contact` sur un hébergement avec serveur (voir
 * `src/lib/server/contact-route.ts`), ou un service de formulaires sur un hébergement
 * statique. Absente sur GitHub Pages : la lettre part alors de la messagerie du visiteur.
 */
const CONTACT_ENDPOINT = process.env.NEXT_PUBLIC_CONTACT_ENDPOINT ?? '';

type Status = 'idle' | 'sending' | 'sent' | 'handoff' | 'unavailable' | 'error';

/** La bouteille quitte le bateau dans la scène, et le carnet de bord reçoit son tampon. */
function launchBottle() {
  bottleThrow.requested = true;
  logbook.stamp('bottle');
}

/**
 * Bouteille à la mer. Avec un envoi direct configuré, la confirmation n'arrive qu'APRÈS la
 * réponse positive du serveur. Sans envoi direct, le message est confié à la messagerie du
 * visiteur : le site ne prétend jamais avoir envoyé une lettre qui n'est pas partie.
 */
export function MessageInABottle() {
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const mailto = `mailto:${site.email}?subject=${encodeURIComponent('Une bouteille à la mer')}&body=${encodeURIComponent(
    `${message.trim()}${name.trim() ? `\n\n— ${name.trim()}` : ''}`,
  )}`;

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim() || status === 'sending') return;

    if (!CONTACT_ENDPOINT) {
      launchBottle();
      setStatus('handoff');
      window.location.href = mailto;
      return;
    }

    setStatus('sending');
    try {
      const response = await fetch(CONTACT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ message, name, email, website }),
      });
      if (response.ok) {
        launchBottle();
        setStatus('sent');
        return;
      }
      setStatus(response.status === 503 ? 'unavailable' : 'error');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className="bottle-sent" role="status">
        <p className="hand text-2xl text-ink/80">Ta bouteille est partie, elle vogue vers moi.</p>
        <p className="text-sm text-ink/60">Message bien reçu{email.trim() ? ' : je te réponds à l’adresse indiquée.' : '.'}</p>
      </div>
    );
  }

  return (
    <form className="bottle-form" onSubmit={send} noValidate>
      <label className="eyebrow text-ink" htmlFor="bottle-message">
        Une bouteille à la mer
      </label>
      <textarea
        id="bottle-message"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Ton message, ton projet, ta question…"
        rows={4}
        required
        maxLength={5000}
      />
      <div className="bottle-form__row">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ton nom" aria-label="Ton nom (facultatif)" autoComplete="name" />
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Ton e-mail, pour te répondre"
          aria-label="Ton e-mail (facultatif)"
          type="email"
          autoComplete="email"
        />
      </div>
      {/* Pot de miel anti-robots : invisible et ignoré par les humains. */}
      <input
        className="bottle-form__trap"
        value={website}
        onChange={(event) => setWebsite(event.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <button type="submit" className="stamp-toast__cta" disabled={status === 'sending' || !message.trim()}>
        {status === 'sending'
          ? 'La bouteille part…'
          : CONTACT_ENDPOINT
            ? 'Jeter la bouteille à la mer'
            : 'Envoyer depuis ma messagerie'}
      </button>
      {status === 'handoff' && (
        <p className="bottle-form__note" role="status">
          Ta messagerie s’ouvre avec ton message : il ne reste qu’à l’envoyer. Rien ne s’est ouvert ?{' '}
          <a className="link-underline" href={mailto}>
            Réessayer
          </a>{' '}
          ou écris-moi à {site.email}.
        </p>
      )}
      {status === 'unavailable' && (
        <p className="bottle-form__note" role="alert">
          L’envoi direct n’est pas disponible pour le moment : ton message n’est pas parti.{' '}
          <a className="link-underline" href={mailto}>
            L’envoyer depuis ta messagerie
          </a>
        </p>
      )}
      {status === 'error' && (
        <p className="bottle-form__note" role="alert">
          La bouteille n’a pas pu partir (problème de connexion). Réessaie, ou{' '}
          <a className="link-underline" href={mailto}>
            écris-moi directement
          </a>
          .
        </p>
      )}
    </form>
  );
}
