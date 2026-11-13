'use client';

import { useState } from 'react';
import { site } from '@/data/site';
import { bottleThrow } from '@/components/world/MessageBottle';
import { logbook } from '@/lib/logbook';

type Status = 'idle' | 'sending' | 'sent' | 'unavailable' | 'error';

/**
 * Bouteille à la mer : la lettre part réellement (route /api/contact). La confirmation et
 * la bouteille qui s'éloigne dans la scène n'arrivent qu'APRÈS la réponse positive du
 * serveur. Sinon, le message reste là et le visiteur peut l'envoyer depuis sa messagerie.
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
    setStatus('sending');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, name, email, website }),
      });
      if (response.ok) {
        bottleThrow.requested = true;
        logbook.stamp('bottle');
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
        {status === 'sending' ? 'La bouteille part…' : 'Jeter la bouteille à la mer'}
      </button>
      {status === 'unavailable' && (
        <p className="bottle-form__note" role="alert">
          L’envoi direct n’est pas encore branché sur ce site : ton message n’est pas parti.{' '}
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
