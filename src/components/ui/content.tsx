'use client';

import { useState } from 'react';
import { experiences } from '@/data/experience';
import { journey } from '@/data/journey';
import { projects } from '@/data/projects';
import { site } from '@/data/site';
import { skillGroups } from '@/data/skills';
import type { IslandId } from '@/types';

/**
 * Le contenu de chaque île, en DOM. Ces composants sont partagés entre les panneaux de
 * l'expérience 3D et la Quick View : une seule source pour chaque texte.
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

export function AboutContent() {
  return (
    <div className="space-y-5">
      <p className="text-lg leading-relaxed">{site.intro}</p>
      {site.bio.map((paragraph) => (
        <p key={paragraph.slice(0, 24)} className="text-sm text-ink/70">
          {paragraph}
        </p>
      ))}
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="eyebrow text-ink">Rôle</dt>
          <dd>{site.role}</dd>
        </div>
        <div>
          <dt className="eyebrow text-ink">Basé à</dt>
          <dd>{site.location}</dd>
        </div>
      </dl>
      <a href={site.links.cv} className="ghost-button !text-ink !border-ink/25" download>
        Télécharger le CV
      </a>
    </div>
  );
}

export function SkillsContent() {
  return (
    <div className="space-y-6">
      {skillGroups.map((group) => (
        <section key={group.id} className="space-y-2">
          <h3 className="eyebrow text-ink">{group.label}</h3>
          <p className="text-sm text-ink/60">{group.context}</p>
          <Stack items={group.items} />
        </section>
      ))}
      <p className="text-xs text-ink/45">
        Pas de pourcentages : seulement les technologies utilisées et leur contexte.
      </p>
    </div>
  );
}

export function ProjectsContent() {
  const [openId, setOpenId] = useState<string | null>(projects[0]?.id ?? null);

  return (
    <div className="space-y-3">
      {projects.map((project) => {
        const open = openId === project.id;
        return (
          <article key={project.id} className="border-b border-ink/10 pb-3 last:border-0">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : project.id)}
              className="flex w-full items-baseline justify-between gap-4 text-left"
              aria-expanded={open}
            >
              <span className="text-base font-medium">{project.title}</span>
              <span className="text-xs text-ink/45">{project.year}</span>
            </button>
            <p className="mt-1 text-sm text-ink/65">{project.summary}</p>

            {open && (
              <div className="animate-rise mt-4 space-y-4 text-sm">
                <div>
                  <h4 className="eyebrow text-ink">Problème</h4>
                  <p className="text-ink/70">{project.problem}</p>
                </div>
                <div>
                  <h4 className="eyebrow text-ink">Solution</h4>
                  <p className="text-ink/70">{project.solution}</p>
                </div>
                <div>
                  <h4 className="eyebrow text-ink">Rôle</h4>
                  <p className="text-ink/70">{project.role}</p>
                </div>
                {project.outcomes && (
                  <div>
                    <h4 className="eyebrow text-ink">Résultats</h4>
                    <ul className="list-disc pl-4 text-ink/70">
                      {project.outcomes.map((outcome) => (
                        <li key={outcome}>{outcome}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <Stack items={project.stack} />
                <div className="flex gap-4">
                  {project.links?.github && (
                    <a className="link-underline" href={project.links.github} target="_blank" rel="noreferrer">
                      GitHub
                    </a>
                  )}
                  {project.links?.demo && (
                    <a className="link-underline" href={project.links.demo} target="_blank" rel="noreferrer">
                      Démo
                    </a>
                  )}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function ExperienceContent() {
  return (
    <ol className="space-y-6">
      {experiences.map((entry) => (
        <li key={entry.id} className="border-l border-ink/15 pl-4">
          <p className="eyebrow text-ink">{entry.period}</p>
          <h3 className="text-base font-medium">
            {entry.role} · <span className="text-ink/60">{entry.company}</span>
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-ink/70">
            {entry.missions.map((mission) => (
              <li key={mission}>{mission}</li>
            ))}
          </ul>
          <div className="mt-3">
            <Stack items={entry.stack} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function JourneyContent() {
  return (
    <ol className="space-y-5">
      {journey.map((step) => (
        <li key={step.id} className="flex gap-4">
          <span className="mt-1 shrink-0 text-xs tabular-nums text-ink/45">{step.year}</span>
          <div>
            <h3 className="text-base font-medium">{step.title}</h3>
            <p className="text-sm text-ink/65">{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ContactContent() {
  return (
    <div className="space-y-5">
      <p className="text-lg">Un projet, une question, ou juste envie d’échanger ?</p>
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
