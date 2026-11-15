'use client';

import { useEffect, useRef, useState } from 'react';
import { site } from '@/data/site';
import { bottleThrow } from '@/components/world/MessageBottle';
import { logbook } from '@/lib/logbook';

/** Issues possibles d'un envoi : chaque échec garde le message et propose une suite honnête. */
type Status = 'idle' | 'sending' | 'sent' | 'unavailable' | 'email' | 'short' | 'rate' | 'provider' | 'offline';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Espace insécable avant les deux-points (typographie française). */
const NBSP = ' ';

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
  const sentRef = useRef<HTMLDivElement>(null);

  const mailto = `mailto:${site.email}?subject=${encodeURIComponent('Une bouteille à la mer')}&body=${encodeURIComponent(
    `${message.trim()}${name.trim() ? `\n\n— ${name.trim()}` : ''}`,
  )}`;

  // La confirmation prend le focus : elle est annoncée par les lecteurs d'écran.
  useEffect(() => {
    if (status === 'sent') sentRef.current?.focus();
  }, [status]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim() || status === 'sending') return;
    if (email.trim() && !EMAIL.test(email.trim())) {
      setStatus('email');
      return;
    }
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
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (response.status === 503) setStatus('unavailable');
      else if (response.status === 429) setStatus('rate');
      else if (data?.error === 'email') setStatus('email');
      else if (data?.error === 'empty') setStatus('short');
      else setStatus('provider');
    } catch {
      setStatus('offline');
    }
  };

  if (status === 'sent') {
    return (
      <div ref={sentRef} className="bottle-sent" role="status" tabIndex={-1}>
        <p className="hand text-2xl text-ink/80">Ta bouteille est partie, elle vogue vers moi.</p>
        <p className="text-sm text-ink/60">
          {email.trim() ? `Message bien reçu${NBSP}: je te réponds à l’adresse indiquée.` : 'Message bien reçu.'}
        </p>
        <button
          type="button"
          className="link-underline mt-3 text-sm"
          onClick={() => {
            setMessage('');
            setStatus('idle');
          }}
        >
          Écrire une autre bouteille
        </button>
      </div>
    );
  }

  const emailInvalid = status === 'email';

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
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ton nom" aria-label="Ton nom (facultatif)" autoComplete="name" maxLength={120} />
        <input
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (emailInvalid) setStatus('idle');
          }}
          placeholder="Ton e-mail, pour te répondre"
          aria-label="Ton e-mail (facultatif)"
          aria-invalid={emailInvalid || undefined}
          aria-describedby={emailInvalid ? 'bottle-note' : undefined}
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={200}
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
        <p id="bottle-note" className="bottle-form__note" role="alert">
          {`L’envoi direct n’est pas encore branché sur ce site${NBSP}: ton message n’est pas parti.`}{' '}
          <a className="link-underline" href={mailto}>
            L’envoyer depuis ta messagerie
          </a>
        </p>
      )}
      {status === 'email' && (
        <p id="bottle-note" className="bottle-form__note" role="alert">
          {`Cette adresse e-mail semble incomplète${NBSP}: corrige-la, ou laisse le champ vide.`}
        </p>
      )}
      {status === 'short' && (
        <p id="bottle-note" className="bottle-form__note" role="alert">
          {`Ton message est un peu court${NBSP}: ajoute quelques mots.`}
        </p>
      )}
      {status === 'rate' && (
        <p id="bottle-note" className="bottle-form__note" role="alert">
          {`Beaucoup de bouteilles en peu de temps${NBSP}: ton message n’est pas parti. Réessaie dans quelques minutes, ou`}{' '}
          <a className="link-underline" href={mailto}>
            écris-moi directement
          </a>
          .
        </p>
      )}
      {status === 'provider' && (
        <p id="bottle-note" className="bottle-form__note" role="alert">
          {`Le service d’envoi n’a pas répondu${NBSP}: ton message n’est pas parti. Réessaie, ou`}{' '}
          <a className="link-underline" href={mailto}>
            envoie-le depuis ta messagerie
          </a>
          .
        </p>
      )}
      {status === 'offline' && (
        <p id="bottle-note" className="bottle-form__note" role="alert">
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
