'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { site } from '@/data/site';
import { bottleThrow } from '@/components/world/MessageBottle';
import { asset } from '@/lib/asset';
import { logbook } from '@/lib/logbook';
import { NBSP, NNBSP } from './typography';

/**
 * Adresse d'envoi direct, fixée à la construction :
 *  - `NEXT_PUBLIC_CONTACT_ENDPOINT` s'il est défini (service de formulaires qui accepte un
 *    POST JSON, comme Formspree) ;
 *  - sinon la route `/api/contact` du site, quand il tourne avec un serveur (dev, Vercel :
 *    voir src/lib/server/contact-route.ts) ;
 *  - aucune dans l'export statique de GitHub Pages : la lettre part alors de la messagerie
 *    du visiteur, et le site ne prétend jamais l'avoir envoyée.
 */
const CONTACT_ENDPOINT =
  process.env.NEXT_PUBLIC_CONTACT_ENDPOINT || (process.env.NEXT_PUBLIC_STATIC_EXPORT ? '' : asset('/api/contact'));

/** Issues possibles d'un envoi : chaque échec garde le message et propose une suite honnête. */
type Status = 'idle' | 'sending' | 'sent' | 'handoff' | 'unavailable' | 'email' | 'short' | 'rate' | 'provider' | 'offline';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Téléphone : le clavier virtuel réduit la zone visible (visualViewport) sans déplacer la feuille
 * fixe qui porte le formulaire. Sa hauteur est publiée dans `--kb` (marge basse de la feuille,
 * globals.css) et le champ actif est ramené au-dessus du clavier. Mise en page seulement.
 */
function useKeyboardInset(form: RefObject<HTMLFormElement | null>, mounted: boolean) {
  useEffect(() => {
    const element = form.current;
    const viewport = window.visualViewport;
    if (!mounted || !element || !viewport) return;
    const root = document.documentElement;
    let active: HTMLElement | null = null;
    let frame = 0;
    let release = 0;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      root.style.setProperty('--kb', `${Math.round(inset)}px`);
      if (!active || inset <= 0) return;
      const field = active;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        field.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
      });
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement) || !event.target.matches('input, textarea')) return;
      window.clearTimeout(release);
      active = event.target;
      viewport.addEventListener('resize', update);
      update();
    };
    const onFocusOut = () => {
      active = null;
      // Le focus passe peut-être au champ suivant : on attend un instant avant de tout relâcher.
      window.clearTimeout(release);
      release = window.setTimeout(() => {
        viewport.removeEventListener('resize', update);
        root.style.setProperty('--kb', '0px');
      }, 300);
    };
    element.addEventListener('focusin', onFocusIn);
    element.addEventListener('focusout', onFocusOut);
    return () => {
      element.removeEventListener('focusin', onFocusIn);
      element.removeEventListener('focusout', onFocusOut);
      viewport.removeEventListener('resize', update);
      cancelAnimationFrame(frame);
      window.clearTimeout(release);
      root.style.setProperty('--kb', '0px');
    };
  }, [form, mounted]);
}

/** La bouteille quitte le bateau dans la scène, et le carnet de bord reçoit son tampon. */
function launchBottle() {
  bottleThrow.requested = true;
  logbook.stamp('bottle');
}

/**
 * Bouteille à la mer : avec un envoi direct, la lettre part réellement. La confirmation et
 * la bouteille qui s'éloigne dans la scène n'arrivent qu'APRÈS la réponse positive du
 * serveur. Sinon, le message reste là et le visiteur peut l'envoyer depuis sa messagerie.
 * Sans envoi direct (GitHub Pages), le message est confié d'emblée à sa messagerie.
 */
export function MessageInABottle() {
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const sentRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useKeyboardInset(formRef, status !== 'sent');

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
    <form ref={formRef} className="bottle-form" onSubmit={send} noValidate>
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
          placeholder="Ton e-mail"
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
        {status === 'sending'
          ? 'La bouteille part…'
          : CONTACT_ENDPOINT
            ? 'Jeter la bouteille à la mer'
            : 'Envoyer depuis ma messagerie'}
      </button>
      {status === 'handoff' && (
        <p id="bottle-note" className="bottle-form__note" role="status">
          {`Ta messagerie s’ouvre avec ton message${NBSP}: il ne reste qu’à l’envoyer. Rien ne s’est ouvert${NNBSP}?`}{' '}
          <a className="link-underline" href={mailto}>
            Réessayer
          </a>
          {`, ou écris-moi à ${site.email}.`}
        </p>
      )}
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
