'use client';

import { useEffect, useRef, useState } from 'react';
import { experiences } from '@/data/experience';
import { journey } from '@/data/journey';
import { projects, STATUS_LABEL } from '@/data/projects';
import { site } from '@/data/site';
import { skillZones } from '@/data/skills';
import { useFocus, useFocusedItem } from '@/lib/focus';
import type { IslandId, Project, SkillItem } from '@/types';
import { MessageInABottle } from './MessageInABottle';

/**
 * Le contenu de chaque île, en DOM. Ces composants sont partagés entre les panneaux de
 * l'expérience 3D et la Quick View : une seule source pour chaque texte (data/*.ts).
 */

function Stack({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li key={item} className="chip">
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Fait défiler jusqu'à l'élément ciblé depuis la 3D et le met en valeur un instant. */
function useFocusScroll(island: IslandId, id: string) {
  const ref = useRef<HTMLElement | null>(null);
  const focused = useFocusedItem(island) === id;
  const at = useFocus((state) => state.at);
  useEffect(() => {
    if (!focused || !ref.current) return;
    const element = ref.current;
    const frame = requestAnimationFrame(() => element.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    element.classList.remove('is-focused');
    void element.offsetWidth;
    element.classList.add('is-focused');
    return () => cancelAnimationFrame(frame);
  }, [at, focused]);
  return { ref, focused };
}

/* ------------------------------------------------------------------ À PROPOS */

export function AboutContent() {
  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-relaxed text-ink/85">{site.about}</p>
      <dl className="facts">
        <div>
          <dt className="eyebrow text-ink">Rôle</dt>
          <dd>{site.role}</dd>
        </div>
        <div>
          <dt className="eyebrow text-ink">Basé à</dt>
          <dd>{site.location}</dd>
        </div>
        <div>
          <dt className="eyebrow text-ink">Origine</dt>
          <dd>{site.origin}</dd>
        </div>
        <div>
          <dt className="eyebrow text-ink">Aujourd’hui</dt>
          <dd>
            {site.current.contract} · {site.current.company} ({site.current.place})
          </dd>
        </div>
      </dl>
      <div className="space-y-2">
        <h3 className="eyebrow text-ink">Ce qui m’anime</h3>
        <Stack items={site.passions} />
      </div>
      <div className="flex flex-wrap gap-2">
        {site.links.cv && (
          <a href={site.links.cv} className="paper-button" download>
            Télécharger le CV
          </a>
        )}
        <a href={site.links.linkedin} className="paper-button" target="_blank" rel="noreferrer">
          LinkedIn
        </a>
        <a href={site.links.github} className="paper-button" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- COMPÉTENCES */

function SkillChip({ item }: { item: SkillItem }) {
  return (
    <li className={item.level === 'pro' ? 'chip' : 'chip chip--explore'} title={item.level === 'pro' ? 'Utilisé dans mon travail' : 'En exploration'}>
      {item.name}
    </li>
  );
}

function SkillZoneBlock({ zone }: { zone: (typeof skillZones)[number] }) {
  const { ref } = useFocusScroll('skills', zone.id);
  return (
    <section ref={ref as React.RefObject<HTMLElement>} className="focus-target space-y-2">
      <h3 className="eyebrow" style={{ color: 'var(--ink)' }}>
        <span className="zone-dot" style={{ background: zone.accent }} aria-hidden="true" />
        {zone.label}
      </h3>
      <p className="text-sm text-ink/60">{zone.context}</p>
      <ul className="flex flex-wrap gap-1.5">
        {zone.items.map((item) => (
          <SkillChip key={item.name} item={item} />
        ))}
      </ul>
    </section>
  );
}

export function SkillsContent() {
  return (
    <div className="space-y-6">
      <p className="legend">
        <span className="chip">Utilisé dans mon travail</span>
        <span className="chip chip--explore">En exploration</span>
      </p>
      {skillZones.map((zone) => (
        <SkillZoneBlock key={zone.id} zone={zone} />
      ))}
      <p className="text-xs text-ink/45">Pas de pourcentages : ce que j’utilise, et ce que j’apprends.</p>
    </div>
  );
}

/* ------------------------------------------------------------------- PROJETS */

function StatusBadge({ project }: { project: Project }) {
  return (
    <span className={`status status--${project.status}`}>{project.statusLabel ?? STATUS_LABEL[project.status]}</span>
  );
}

function ProjectCard({ project, open, onToggle }: { project: Project; open: boolean; onToggle: () => void }) {
  const { ref } = useFocusScroll('projects', project.id);
  return (
    <article ref={ref as React.RefObject<HTMLElement>} className="focus-target border-b border-ink/10 pb-3 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-baseline justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="project-index" style={{ color: project.accent }}>
            {project.index}
          </span>
          <span className="text-base font-medium">{project.title}</span>
        </span>
        <StatusBadge project={project} />
      </button>
      <p className="mt-0.5 text-xs text-ink/50">
        {project.kind} · {project.context}
      </p>
      <p className="mt-1 text-sm text-ink/70">{project.summary}</p>

      {open && (
        <div className="animate-rise mt-4 space-y-4 text-sm">
          {project.screenshots && project.screenshots.length > 0 && (
            <div className="shots">
              {project.screenshots.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element -- captures statiques, tailles variables
                <img key={src} src={src} alt={`Capture de ${project.title}`} loading="lazy" />
              ))}
            </div>
          )}
          <div>
            <h4 className="eyebrow text-ink">Ce que j’ai fait</h4>
            <ul className="list-disc pl-4 text-ink/75">
              {project.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          {project.feature && (
            <div className="feature-card">
              <h4 className="eyebrow text-ink">Zoom · {project.feature.title}</h4>
              <ul className="list-disc pl-4 text-ink/75">
                {project.feature.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              {project.feature.url && (
                <a className="link-underline mt-2 inline-block text-xs" href={project.feature.url} target="_blank" rel="noreferrer">
                  Voir la page ↗
                </a>
              )}
            </div>
          )}
          {project.parts && (
            <ul className="space-y-1">
              {project.parts.map((part) => (
                <li key={part.name} className="flex items-baseline justify-between gap-3">
                  <span>
                    {part.name} <span className="text-ink/50">· {part.note}</span>
                  </span>
                  {part.status && <span className={`status status--${part.status}`}>{STATUS_LABEL[part.status]}</span>}
                </li>
              ))}
            </ul>
          )}
          <Stack items={project.stack} />
          {project.url && (
            <a className="paper-button" href={project.url} target="_blank" rel="noreferrer">
              Voir le site ↗
            </a>
          )}
        </div>
      )}
    </article>
  );
}

export function ProjectsContent() {
  const focused = useFocusedItem('projects');
  const [openId, setOpenId] = useState<string | null>(projects[0]?.id ?? null);
  const [seenFocus, setSeenFocus] = useState<string | null>(null);
  // Un clic sur un bâtiment de la ville déplie directement son projet.
  if (focused && focused !== seenFocus) {
    setSeenFocus(focused);
    setOpenId(focused);
  }

  return (
    <div className="space-y-3">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          open={openId === project.id}
          onToggle={() => setOpenId(openId === project.id ? null : project.id)}
        />
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- EXPÉRIENCES */

function ExperienceItem({ entry }: { entry: (typeof experiences)[number] }) {
  const { ref } = useFocusScroll('experience', entry.id);
  return (
    <li ref={ref as React.RefObject<HTMLLIElement>} className="focus-target border-l border-ink/15 pl-4">
      <p className="eyebrow text-ink">
        {entry.period}
        {entry.contract ? ` · ${entry.contract}` : ''}
      </p>
      <h3 className="text-base font-medium">
        {entry.role} · <span className="text-ink/60">{entry.company}</span>
      </h3>
      {entry.location && <p className="text-xs text-ink/50">{entry.location}</p>}
      <ul className="mt-2 space-y-1 text-sm text-ink/70">
        {entry.missions.map((mission) => (
          <li key={mission}>{mission}</li>
        ))}
      </ul>
      <div className="mt-3">
        <Stack items={entry.stack} />
      </div>
    </li>
  );
}

export function ExperienceContent() {
  return (
    <ol className="space-y-6">
      {experiences.map((entry) => (
        <ExperienceItem key={entry.id} entry={entry} />
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ PARCOURS */

function JourneyItem({ step, index }: { step: (typeof journey)[number]; index: number }) {
  const { ref } = useFocusScroll('journey', step.id);
  return (
    <li ref={ref as React.RefObject<HTMLLIElement>} className="focus-target flex gap-4">
      <span className={`journey-dot journey-dot--${step.side}`} aria-hidden="true">
        {index + 1}
      </span>
      <div>
        <p className="eyebrow text-ink/60">{step.marker}</p>
        <h3 className="text-base font-medium">{step.title}</h3>
        <p className="text-sm text-ink/65">{step.description}</p>
      </div>
    </li>
  );
}

export function JourneyContent() {
  return (
    <ol className="space-y-5">
      {journey.map((step, index) => (
        <JourneyItem key={step.id} step={step} index={index} />
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------- CONTACT */

export function ContactContent() {
  return (
    <div className="space-y-5">
      <p className="text-lg">Un projet, une question, ou juste envie d’échanger ?</p>
      <MessageInABottle />
      <ul className="space-y-2 text-sm">
        <li>
          <a className="link-underline" href={`mailto:${site.email}`}>
            {site.email}
          </a>
        </li>
        <li>
          <a className="link-underline" href={site.links.linkedin} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        </li>
        <li>
          <a className="link-underline" href={site.links.github} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </li>
        {site.links.cv && (
          <li>
            <a className="link-underline" href={site.links.cv} download>
              CV (PDF)
            </a>
          </li>
        )}
      </ul>
      <p className="hand text-xl text-ink/50">Basé à {site.location}.</p>
    </div>
  );
}

export const islandContent: Record<IslandId, () => React.ReactElement> = {
  about: AboutContent,
  skills: SkillsContent,
  projects: ProjectsContent,
  experience: ExperienceContent,
  journey: JourneyContent,
  contact: ContactContent,
};
