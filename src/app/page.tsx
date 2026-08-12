import { ExperienceLoader } from '@/components/experience/ExperienceLoader';
import { experiences } from '@/data/experience';
import { islands } from '@/data/islands';
import { journey } from '@/data/journey';
import { projects } from '@/data/projects';
import { site } from '@/data/site';
import { skillGroups } from '@/data/skills';

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: site.name,
  jobTitle: site.role,
  email: `mailto:${site.email}`,
  url: site.url,
  address: { '@type': 'PostalAddress', addressLocality: 'Marseille', addressCountry: 'FR' },
  sameAs: [site.links.github, site.links.linkedin],
};

/**
 * Le contenu est rendu côté serveur en HTML sémantique, puis masqué visuellement.
 * Les moteurs de recherche et les lecteurs d'écran ne dépendent donc jamais du canvas.
 * L'expérience 3D vient se superposer par-dessus.
 */
export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="sr-only">
        <h1>
          {site.name} — {site.role}
        </h1>
        <p>{site.intro}</p>

        <section id="about">
          <h2>About</h2>
          {site.bio.map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
        </section>

        <section id="skills">
          <h2>Skills</h2>
          {skillGroups.map((group) => (
            <div key={group.id}>
              <h3>{group.label}</h3>
              <p>{group.context}</p>
              <ul>
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section id="projects">
          <h2>Projects</h2>
          {projects.map((project) => (
            <article key={project.id}>
              <h3>{project.title}</h3>
              <p>{project.summary}</p>
              <p>{project.problem}</p>
              <p>{project.solution}</p>
              <p>{project.stack.join(', ')}</p>
            </article>
          ))}
        </section>

        <section id="experience">
          <h2>Experience</h2>
          {experiences.map((entry) => (
            <article key={entry.id}>
              <h3>
                {entry.role} — {entry.company}
              </h3>
              <p>{entry.period}</p>
              <ul>
                {entry.missions.map((mission) => (
                  <li key={mission}>{mission}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section id="journey">
          <h2>Journey</h2>
          {journey.map((step) => (
            <div key={step.id}>
              <h3>
                {step.year} — {step.title}
              </h3>
              <p>{step.description}</p>
            </div>
          ))}
        </section>

        <section id="contact">
          <h2>Contact</h2>
          <a href={`mailto:${site.email}`}>{site.email}</a>
          <a href={site.links.github}>GitHub</a>
          <a href={site.links.linkedin}>LinkedIn</a>
        </section>

        <nav>
          {islands.map((island) => (
            <a key={island.id} href={`/?section=${island.id}`}>
              {island.label}
            </a>
          ))}
        </nav>
      </main>

      <ExperienceLoader />
    </>
  );
}
