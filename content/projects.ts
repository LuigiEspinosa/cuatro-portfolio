export interface ProjectEntry {
  id: string;
  name: string;
  description: string;
  tech: string[];
  github?: string;
  live?: string;
}

export const projects: ProjectEntry[] = [
  {
    id: 'digital-library',
    name: 'Digital Library',
    description:
      'A self-hosted, privacy-first digital library supporting EPUB, PDF, and CBZ/CBR comics. Runs entirely on Docker Compose with no external cloud dependencies or recurring costs. Features full-text search with FTS5 BM25 ranking, metadata enrichment from OpenLibrary and ComicVine, and Kindle delivery via SMTP.',
    tech: [
      'HTML5/CSS3',
      'Javascript',
      'TypeScript',
      'SvelteKit',
      'Vitest',
      'Fastify',
      'SQLite',
      'BullMQ',
      'Chokidar',
      'Redis',
      'Docker',
      'Nodemailer (SMTP)',
      'Caddy',
      'Hetzner VPS',
      'Cloudflare',
    ],
    github: 'https://github.com/LuigiEspinosa/digital-library',
    live: 'https://library.cuatro.dev',
  },
];
