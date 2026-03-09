export interface WorkEntry {
  id: string;
  company: string;
  role: string;
  period: string;
  location: string;
  description: string;
  highlights: string[];
  tech: string[];
  initiative?: string;
}

export const work: WorkEntry[] = [
  {
    id: 'publicis-global-delivery',
    company: 'Publicis Global Delivery',
    role: 'Senior Frontend Engineer',
    period: 'Oct. 2023 - Dev. 2025',
    location: 'Remote',
    initiative: 'Automation Initiatives Lead',
    description:
      'Engineered Digital Sales Presentations for Pfizer using React, Astro, and Veeva CRM, ensuring compliance with regulatory and business requirements.',
    highlights: [
      'Designed scalable, modular solutions supporting multiple Pfizer product portfolios and international markets, integrating Salesforce data and dynamic HCP experiences.',
      'Built reusable UI components (formulary drilldowns, coverage modals) and automated content workflows to reduce cycle time and improve HCP engagement.',
      'Elevated code quality through peer reviews, linting standards, and knowledge sharing across global delivery teams.',
      'Developed an Upload App for Veeva CRM assets: automated packaging and validation of CLM ZIPs, rendition checks, metadata generation, and environment promotion.',
      'Integrated Veeva Vault PromoMats APIs to sync metadata, manage asset lifecycles, and reduce manual release steps.',
    ],
    tech: [
      'HTML5/CSS3',
      'React',
      'Astro',
      'Javascript',
      'TypeScript',
      'Node.js',
      'Zustand',
      'Veeva CRM',
      'Veeva Vault',
      'Salesforce (SOQL)',
      'Next.js',
      'Tailwind CSS',
      'Shadcn/ui',
      'Nests.js',
      'Redux',
      'CI/CD Pipelines',
      'Azure',
      'Gotenberg API',
      'Adobe Photoshop',
      'Adobe Illustrator',
      'Adobe InDesign',
      'SCRUM',
      'Git',
      'GitLab',
    ],
  },
  {
    id: 'crossbridge-global-partners',
    company: 'Crossbridge Global Partners',
    role: 'Frontend Developer',
    period: 'Aug. 2021 - Nov. 2023',
    location: 'Remote',
    description:
      'Delivered bespoke web solutions for clients including Quigley Simpson, OneClock, TikTok, ProMedica, and Lexus.',
    highlights: [
      "Engineered the migration of ProMedica's website to Sitecore, rebuilding the frontend architecture with Next.js and integrating CMS workflows for scalable content delivery.",
      'Implemented designs with WordPress, Shopify API, and Next.js for multiple client brands.',
      'Ensured WCAG accessibility compliance and rapid issue resolution across all client projects.',
      'Improved website performance with React/Next.js and Vue/Nuxt.js architectures, cutting page load times by up to 40%.',
      'Integrated GraphQL and REST APIs to streamline data retrieval across client platforms.',
    ],
    tech: [
      'HTML5/CSS3',
      'WordPress',
      'PHP',
      'Shopify',
      'Liquid',
      'Javascript',
      'Typescript',
      'React',
      'Next.js',
      'Vue',
      'Nuxt.js',
      'Tailwind CSS',
      'Chakra UI',
      'GSAP',
      'Three.js',
      'Playwright',
      'Storybook',
      'Sitecore CMS',
      'GraphQL',
      'Solr',
      'AWS',
      'Docker',
      'Sketch',
      'Figma',
      'Adobe XD',
      'Git',
      'Github',
    ],
  },
  {
    id: 'webcat-app',
    company: 'Webcat APP',
    role: 'Fullstack Developer',
    period: 'Aug. 2020 - Jun. 2021',
    location: 'Remote',
    description:
      'Built a therapy platform with video conferencing, appointment scheduling, and note-taking to enhance clinician-patient interaction.',
    highlights: [
      'Integrated Twilio API for real-time video conferencing between clinicians and patients.',
      'Designed and deployed reusable UI kits, accelerating UX development cycles.',
    ],
    tech: [
      'HTML5/CSS3',
      'Vue',
      'Nuxt.js',
      'Node.js',
      'Javascript',
      'TypeScript',
      'SCSS/SASS',
      'Vuetify',
      'Twilio API',
      'Playwright',
      'Firebase',
      'Webcat',
      'Figma',
      'Git',
      'Bitbucket',
      'Emal Development',
    ],
  },
  {
    id: 'namecol',
    company: 'Namecol S.A.S.',
    role: 'Web Developer',
    period: 'Feb. 2017 - Jul. 2020',
    location: 'Bogota, Colombia',
    description:
      'Implemented responsive design and SEO strategies for client sites, and optimized e-commerce storefronts.',
    highlights: [
      'Boosted search visibility and reduced bounce rates through responsive design and SEO implementation.',
      'Optimized PrestaShop and Shopify storefronts to increase loading speed and improve e-commerce conversion rates.',
    ],
    tech: [
      'HTML5/CSS3',
      'JavaScript',
      'jQuery',
      'PHP',
      'PrestaShop',
      'Symfony',
      'Shopify',
      'Liquid',
      'Google Analytics',
      'Adobe Photoshop',
    ],
  },
];

