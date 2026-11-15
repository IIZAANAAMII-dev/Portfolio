'use client';

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { experiences } from '@/data/experience';
import { islandById } from '@/data/islands';
import { journey } from '@/data/journey';
import { experiments, projects, STATUS_LABEL } from '@/data/projects';
import { site } from '@/data/site';
import { skillZones } from '@/data/skills';
import { useWorld } from '@/lib/store';
import type { Experiment, IslandId, Project } from '@/types';
import { fr } from './content';
import { MessageInABottle } from './MessageInABottle';
import styles from './quickview.module.css';

/** Ordre de lecture pensé pour un recruteur : qui, ce que je fais, avec quoi, où, comment me joindre. */
const ORDER: IslandId[] = ['about', 'projects', 'skills', 'experience', 'journey', 'contact'];

/*
 * Ancres propres à la version rapide : le contenu SEO de page.tsx (masqué visuellement)
 * porte déjà les identifiants « about », « contact »… et capterait les liens du sommaire.
 */
const anchor = (id: IslandId) => `qv-${id}`;
const pad = (value: number) => String(value).padStart(2, '0');
const accent = (color: string) => ({ ['--accent' as string]: color }) as CSSProperties;
const YEAR = new Date().getFullYear();
const [FIRST_NAME, ...LAST_NAME] = site.name.split(' ');

function host(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ------------------------------------------------------------------ Icônes */

const ICONS = {
  out: <path d="M5 11 11 5M6.5 5H11v4.5" />,
  back: <path d="M12.5 8h-9M7 4.5 3.5 8 7 11.5" />,
  mail: (
    <>
      <rect x="2" y="3.5" width="12" height="9" rx="1.6" />
      <path d="m2.6 4.6 5.4 4.2 5.4-4.2" />
    </>
  ),
  download: <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" />,
  up: <path d="M8 13V3.5M4.5 7 8 3.5 11.5 7" />,
};

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

function External({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a href={href} className={className} target="_blank" rel="noreferrer">
      {children}
      <Icon name="out" />
      <span className="sr-only"> (nouvel onglet)</span>
    </a>
  );
}

function Chips({ items, label }: { items: string[]; label?: string }) {
  return (
    <ul className={styles.chips} aria-label={label}>
      {items.map((item) => (
        <li key={item} className="chip">
          {item}
        </li>
      ))}
    </ul>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item}>{fr(item)}</li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ Sections */

function Section({ id, index, children }: { id: IslandId; index: number; children: ReactNode }) {
  const island = islandById[id];
  return (
    <section
      id={anchor(id)}
      className={styles.section}
      aria-labelledby={`${anchor(id)}-title`}
      tabIndex={-1}
      style={accent(island.accent)}
    >
      <header className={styles.sectionHead}>
        <span className={styles.sectionNum} aria-hidden="true">
          {pad(index + 1)}
        </span>
        <div>
          <h2 id={`${anchor(id)}-title`} className={styles.sectionTitle}>
            {island.label}
          </h2>
          <p className={styles.sectionTagline}>{fr(island.tagline)}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function About() {
  return (
    <div className={`${styles.card} ${styles.about}`}>
      <p className={styles.lead}>{fr(site.about)}</p>
      <div className={styles.aboutSide}>
        <h3 className={styles.subhead}>Origine</h3>
        <p>{site.origin}</p>
        <h3 className={styles.subhead}>Ce qui m’anime</h3>
        <Chips items={site.passions} />
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const titleId = `qv-project-${project.id}`;
  const shots = project.screenshots ?? [];
  return (
    <article className={`${styles.card} ${styles.project}`} style={accent(project.accent)} aria-labelledby={titleId}>
      <header className={styles.projectHead}>
        <span className={styles.projectIndex} aria-hidden="true">
          {project.index}
        </span>
        <div>
          <h3 id={titleId} className={styles.projectTitle}>
            {project.title}
          </h3>
          <p className={styles.projectMeta}>
            {project.kind} · {project.context}
          </p>
        </div>
        <p className={styles.projectTags}>
          {project.badge && <span className="project-badge">{project.badge}</span>}
          <span className={`status status--${project.status}`}>{project.statusLabel ?? STATUS_LABEL[project.status]}</span>
        </p>
      </header>

      <div className={styles.projectBody} data-media={shots.length > 0 || undefined}>
        <div className={styles.projectText}>
          <p className={styles.summary}>{fr(project.summary)}</p>
          <h4 className={styles.subhead}>Ce que j’ai fait</h4>
          <Bullets items={project.highlights} />
          {project.parts && (
            <>
              <h4 className={styles.subhead}>Les sites</h4>
              <ul className={styles.parts}>
                {project.parts.map((part) => (
                  <li key={part.name}>
                    <span>{part.name}</span>
                    {part.status && <span className={`status status--${part.status}`}>{STATUS_LABEL[part.status]}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {project.feature && (
            <div className={styles.feature}>
              <h4 className={styles.subhead}>Zoom · {fr(project.feature.title)}</h4>
              <Bullets items={project.feature.points} />
              {project.feature.url && (
                <External href={project.feature.url} className={styles.textLink}>
                  Voir la page · {host(project.feature.url)}
                </External>
              )}
            </div>
          )}
        </div>
        {shots.length > 0 && (
          <div className={styles.media}>
            {shots.map((src, index) => {
              const image = (
                // eslint-disable-next-line @next/next/no-img-element -- captures statiques 1280 × 800
                <img
                  src={src}
                  alt={`Capture d’écran de ${project.title}${shots.length > 1 ? ` (${index + 1} sur ${shots.length})` : ''}`}
                  width={1280}
                  height={800}
                  loading="lazy"
                  decoding="async"
                />
              );
              return project.url ? (
                <a key={src} href={project.url} target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden="true">
                  {image}
                </a>
              ) : (
                <div key={src}>{image}</div>
              );
            })}
          </div>
        )}
      </div>

      <footer className={styles.projectFoot}>
        <Chips items={project.stack} label="Technologies" />
        {project.url && (
          <External href={project.url} className={styles.siteLink}>
            Voir le site · {host(project.url)}
          </External>
        )}
      </footer>
    </article>
  );
}

function ExperimentCard({ experiment }: { experiment: Experiment }) {
  const titleId = `qv-experiment-${experiment.id}`;
  return (
    <article className={`${styles.card} ${styles.experiment}`} aria-labelledby={titleId}>
      <div className={styles.experimentHead}>
        <h3 id={titleId} className={styles.experimentTitle}>
          {experiment.title}
        </h3>
        <p className={styles.projectMeta}>Expérimentation personnelle · {experiment.kind}</p>
      </div>
      <p className={styles.summary}>{fr(experiment.summary)}</p>
      <Chips items={experiment.stack} label="Technologies" />
    </article>
  );
}

function Projects() {
  return (
    <div className={styles.projects}>
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
      {experiments.map((experiment) => (
        <ExperimentCard key={experiment.id} experiment={experiment} />
      ))}
    </div>
  );
}

function Skills() {
  return (
    <>
      <p className={styles.legend}>
        <span className="chip">Utilisé dans mon travail</span>
        <span className="chip chip--explore">En exploration</span>
        <span className={styles.legendNote}>{fr('Pas de pourcentages : ce que j’utilise, et ce que j’apprends.')}</span>
      </p>
      <div className={styles.zones}>
        {skillZones.map((zone) => (
          <div key={zone.id} className={`${styles.card} ${styles.zone}`} style={accent(zone.accent)}>
            <h3 className={styles.zoneTitle}>
              <span className={styles.zoneDot} aria-hidden="true" />
              {zone.label}
            </h3>
            <p className={styles.zoneContext}>{fr(zone.context)}</p>
            <ul className={styles.chips}>
              {zone.items.map((item) => (
                <li key={item.name} className={item.level === 'pro' ? 'chip' : 'chip chip--explore'}>
                  {item.name}
                  {item.level === 'exploration' && <span className="sr-only"> (en exploration)</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}

function Experiences() {
  return (
    <ol className={styles.jobs}>
      {experiences.map((entry) => (
        <li key={entry.id} className={`${styles.card} ${styles.job}`}>
          <div className={styles.jobGrid}>
            <p className={styles.jobWhen}>
              <span className={styles.jobPeriod}>{entry.period}</span>
              {entry.contract && <span>{entry.contract}</span>}
              {entry.location && <span>{entry.location}</span>}
            </p>
            <div>
              <h3 className={styles.jobRole}>{entry.role}</h3>
              <p className={styles.jobCompany}>{entry.company}</p>
              <Bullets items={entry.missions} />
              <Chips items={entry.stack} label="Technologies" />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Journey() {
  return (
    <ol className={`${styles.card} ${styles.route}`}>
      {journey.map((step, index) => (
        <li key={step.id} className={styles.step}>
          <span className={`journey-dot journey-dot--${step.side}`} aria-hidden="true">
            {index + 1}
          </span>
          <div>
            <p className={styles.stepMarker}>{step.marker}</p>
            <h3 className={styles.stepTitle}>{step.title}</h3>
            <p className={styles.stepText}>{fr(step.description)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Contact() {
  return (
    <div className={`${styles.card} ${styles.contact}`}>
      <div className={styles.bottle}>
        <p className={styles.contactLead}>{fr('Un projet, une question, ou juste envie d’échanger ?')}</p>
        <MessageInABottle />
      </div>
      <div className={styles.direct}>
        <h3 className={styles.subhead}>En direct</h3>
        <ul className={styles.directList}>
          <li>
            <a href={`mailto:${site.email}`}>
              <Icon name="mail" />
              <span>{site.email}</span>
            </a>
          </li>
          <li>
            <External href={site.links.linkedin}>
              <span>LinkedIn</span>
            </External>
          </li>
          <li>
            <External href={site.links.github}>
              <span>GitHub</span>
            </External>
          </li>
          {site.links.cv && (
            <li>
              <a href={site.links.cv} download>
                <Icon name="download" />
                <span>CV (PDF)</span>
              </a>
            </li>
          )}
        </ul>
        <p className={styles.based}>Basé à {site.location}.</p>
      </div>
    </div>
  );
}

const SECTIONS: Record<IslandId, () => ReactNode> = {
  about: About,
  projects: Projects,
  skills: Skills,
  experience: Experiences,
  journey: Journey,
  contact: Contact,
};

/* ------------------------------------------------------------------ Page */

/**
 * Version rapide : tout le portfolio sur une page, lisible en deux minutes.
 * Ce n'est pas un mode dégradé : c'est le chemin direct pour un recruteur pressé, un
 * appareil ancien, ou une absence de WebGL. Aucune animation ne conditionne l'affichage
 * (le seul fondu d'entrée est en CSS, ignoré en mouvement réduit) : le contenu est
 * visible dès le premier rendu, même si le fil principal est encombré.
 */
export function QuickView() {
  const setQuickView = useWorld((s) => s.setQuickView);
  const webglFailed = useWorld((s) => s.webglFailed);
  const [active, setActive] = useState<IslandId>(ORDER[0]);
  const tocList = useRef<HTMLOListElement>(null);

  useEffect(() => {
    document.body.classList.add('is-quick-view');
    // Le contenu SEO de page.tsx doublerait toute la page pour les lecteurs d'écran (deux
    // titres principaux, deux zones principales) : il est retiré tant que la version rapide est ouverte.
    const seo = document.querySelector<HTMLElement>('main.sr-only');
    const seoHidden = seo?.hidden ?? false;
    if (seo) seo.hidden = true;
    return () => {
      document.body.classList.remove('is-quick-view');
      if (seo) seo.hidden = seoHidden;
      window.scrollTo(0, 0);
    };
  }, []);

  // Sommaire : la section en cours de lecture est mise en évidence (amélioration seulement).
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const current = ORDER.find((id) => visible.has(anchor(id)));
        if (current) setActive(current);
      },
      { rootMargin: '-30% 0px -62% 0px' },
    );
    for (const id of ORDER) {
      const element = document.getElementById(anchor(id));
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  // Téléphone : la barre du sommaire suit la lecture.
  useEffect(() => {
    const list = tocList.current;
    if (!list || list.scrollWidth <= list.clientWidth + 1) return;
    const link = list.querySelector<HTMLElement>(`[data-id='${active}']`);
    if (!link) return;
    const box = list.getBoundingClientRect();
    const item = link.getBoundingClientRect();
    list.scrollBy({ left: item.left - box.left - (box.width - item.width) / 2, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [active]);

  const go = (event: MouseEvent<HTMLAnchorElement>, targetId: string) => {
    const target = document.getElementById(targetId);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
  };

  const back = () => setQuickView(false);

  return (
    <div className={styles.root}>
      <a className={styles.skip} href="#qv-main">
        Aller au contenu
      </a>

      <header id="qv-top" className={styles.hero} tabIndex={-1}>
        <div className={styles.heroBar}>
          <p className={styles.kicker}>Version rapide · lecture 2 min</p>
          {!webglFailed && (
            <button type="button" className={styles.btn} onClick={back}>
              <Icon name="back" />
              Revenir à l’expérience 3D
            </button>
          )}
        </div>

        <div className={styles.heroGrid}>
          <div className={styles.heroMain}>
            <h1 className={styles.name}>
              <span>{FIRST_NAME}</span> <span>{LAST_NAME.join(' ')}</span>
            </h1>
            <p className={styles.role}>
              {site.role} · {site.location}
            </p>
            <p className={styles.intro}>{fr(site.intro)}</p>
            <div className={styles.actions}>
              <a className={`${styles.btn} ${styles.btnPrimary}`} href={`#${anchor('contact')}`} onClick={(event) => go(event, anchor('contact'))}>
                <Icon name="mail" />
                Écrire un message
              </a>
              <External href={site.links.linkedin} className={styles.btn}>
                LinkedIn
              </External>
              <External href={site.links.github} className={styles.btn}>
                GitHub
              </External>
              {site.links.cv && (
                <a className={styles.btn} href={site.links.cv} download>
                  <Icon name="download" />
                  CV (PDF)
                </a>
              )}
            </div>
            {webglFailed && (
              <p className={styles.note}>
                L’expérience 3D n’a pas pu démarrer sur cet appareil. Tout le contenu reste accessible ici.
              </p>
            )}
          </div>

          <div className={`${styles.card} ${styles.fiche}`}>
            <h2 className={styles.ficheTitle}>En bref</h2>
            <dl className={styles.facts}>
              <div className={styles.factWide}>
                <dt>Aujourd’hui</dt>
                <dd>
                  {site.current.contract} chez <strong className={styles.nowrap}>{site.current.company}</strong>,{' '}
                  <span className={styles.nowrap}>{site.current.place}</span>
                </dd>
              </div>
              <div>
                <dt>Rôle</dt>
                <dd>{site.role}</dd>
              </div>
              <div>
                <dt>Basé à</dt>
                <dd>{site.location}</dd>
              </div>
              <div className={styles.factWide}>
                <dt>Domaines</dt>
                <dd>
                  <ul className={styles.domains}>
                    {site.current.fields.map((field) => (
                      <li key={field} className="chip">
                        {field}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div className={styles.factWide}>
                <dt>E-mail</dt>
                <dd>
                  <a className={styles.textLink} href={`mailto:${site.email}`}>
                    {site.email}
                  </a>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </header>

      <div className={styles.layout}>
        <nav className={styles.toc} aria-label="Sommaire">
          <p className={styles.tocTitle} aria-hidden="true">
            Sommaire
          </p>
          <ol ref={tocList} className={styles.tocList}>
            {ORDER.map((id, index) => (
              <li key={id}>
                <a
                  href={`#${anchor(id)}`}
                  data-id={id}
                  className={styles.tocLink}
                  style={accent(islandById[id].accent)}
                  aria-current={active === id ? 'location' : undefined}
                  onClick={(event) => go(event, anchor(id))}
                >
                  <b aria-hidden="true">{pad(index + 1)}</b>
                  {islandById[id].label}
                </a>
              </li>
            ))}
          </ol>
          {!webglFailed && (
            <button type="button" className={styles.tocBack} onClick={back}>
              <Icon name="back" />
              Expérience 3D
            </button>
          )}
        </nav>

        <main id="qv-main" className={styles.main} tabIndex={-1}>
          {ORDER.map((id, index) => {
            const Content = SECTIONS[id];
            return (
              <Section key={id} id={id} index={index}>
                <Content />
              </Section>
            );
          })}
        </main>
      </div>

      <footer className={styles.footer}>
        {!webglFailed && (
          <p className={styles.teaser}>{fr('Psst… un projet de jeu se cache quelque part dans l’archipel 3D.')}</p>
        )}
        <div className={styles.footerActions}>
          <a className={styles.btn} href="#qv-top" onClick={(event) => go(event, 'qv-top')}>
            <Icon name="up" />
            Haut de page
          </a>
          {!webglFailed && (
            <button type="button" className={styles.btn} onClick={back}>
              <Icon name="back" />
              Revenir à l’expérience 3D
            </button>
          )}
        </div>
        <p className={styles.copyright}>
          © {YEAR} {site.name} — {site.location}
        </p>
      </footer>
    </div>
  );
}
