/**
 * Field schemas for every editable content document (site_content keys)
 * and table. These drive the schema-driven form engine in forms.js —
 * Naomi edits friendly labelled fields, never raw JSON.
 */

const cta = (key, label) => ({
  key, label, type: 'object',
  fields: [
    { key: 'label', label: 'Button text', type: 'text' },
    { key: 'href', label: 'Link', type: 'text', help: 'e.g. /contact/' },
  ],
});

const img = (key, label, folder) => ({
  key, label, type: 'object',
  fields: [
    { key: 'image', label: 'Image', type: 'image', folder },
    { key: 'alt', label: 'Alt text', type: 'text', help: 'describe the image for accessibility' },
  ],
});

export const contentSchemas = {
  settings: {
    title: 'Global Settings',
    description: 'Company details, social links, and search-engine defaults used across the whole site.',
    schema: [
      { key: 'siteName', label: 'Site name', type: 'text' },
      { key: 'legalName', label: 'Legal name', type: 'text', help: 'shown in the footer copyright' },
      { key: 'location', label: 'Location line', type: 'text' },
      { key: 'email', label: 'Contact email', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      {
        key: 'socials', label: 'Social links', type: 'object',
        fields: [
          { key: 'instagram', label: 'Instagram', type: 'object', fields: [{ key: 'label', label: 'Display name', type: 'text' }, { key: 'url', label: 'URL', type: 'text' }] },
          { key: 'facebook', label: 'Facebook', type: 'object', fields: [{ key: 'label', label: 'Display name', type: 'text' }, { key: 'url', label: 'URL', type: 'text' }] },
          { key: 'linkedin', label: 'LinkedIn', type: 'object', fields: [{ key: 'label', label: 'Display name', type: 'text' }, { key: 'url', label: 'URL', type: 'text' }] },
        ],
      },
      {
        key: 'seo', label: 'Search engine defaults', type: 'object',
        fields: [
          { key: 'title', label: 'Homepage title tag', type: 'text' },
          { key: 'description', label: 'Homepage description', type: 'textarea' },
          { key: 'ogTitle', label: 'Social share title', type: 'text' },
          { key: 'ogDescription', label: 'Social share description', type: 'textarea' },
          { key: 'ogImage', label: 'Social share image', type: 'image', folder: 'seo' },
        ],
      },
    ],
  },

  home_hero: {
    title: 'Homepage — Hero',
    description: 'The full-screen opening of the homepage: slideshow images, headline, and buttons.',
    schema: [
      { key: 'words', label: 'Headline words', type: 'list', itemLabel: 'word', help: 'shown separated by gold dots' },
      { key: 'eyebrow', label: 'Line under headline', type: 'text' },
      { key: 'description', label: 'Description paragraph', type: 'textarea' },
      { key: 'award', label: 'Italic award line', type: 'text' },
      { key: 'slides', label: 'Slideshow images', type: 'items', itemLabel: 'slide', fields: [
        { key: 'image', label: 'Image', type: 'image', folder: 'hero' },
        { key: 'alt', label: 'Alt text', type: 'text' },
      ] },
      cta('primaryCta', 'Gold button'),
      cta('secondaryCta', 'Outline button'),
    ],
  },

  home_stats: {
    title: 'Homepage — Statistics band',
    description: 'The four numbers under the hero. "Counts up" makes the number animate from zero.',
    schema: [
      { key: 'items', label: 'Statistics', type: 'items', itemLabel: 'statistic', fields: [
        { key: 'target', label: 'Number', type: 'number' },
        { key: 'suffix', label: 'Suffix', type: 'text', help: 'e.g. + or % or ★' },
        { key: 'label', label: 'Label', type: 'text' },
        { key: 'count', label: 'Counts up', type: 'checkbox', checkLabel: 'Animate from 0' },
      ] },
    ],
  },

  home_marquee: {
    title: 'Homepage — Scrolling ticker',
    description: 'The phrases that scroll across the gold star band.',
    schema: [{ key: 'items', label: 'Phrases', type: 'list', itemLabel: 'phrase' }],
  },

  home_about: {
    title: 'Homepage — About section',
    description: '"Crafting Exquisite Living Spaces" — text, images, and the three numbered values.',
    schema: [
      { key: 'label', label: 'Small label', type: 'text' },
      { key: 'headingHtml', label: 'Heading', type: 'html', help: 'use <em>…</em> for gold italics and <br> for a line break' },
      { key: 'paragraphs', label: 'Paragraphs', type: 'list', itemType: 'textarea', itemLabel: 'paragraph' },
      { key: 'sigName', label: 'Signature name', type: 'text' },
      { key: 'sigTitle', label: 'Signature title', type: 'text' },
      { key: 'images', label: 'Images', type: 'items', itemLabel: 'image', fields: [
        { key: 'image', label: 'Image', type: 'image', folder: 'about' },
        { key: 'alt', label: 'Alt text', type: 'text' },
      ] },
      { key: 'values', label: 'Value points', type: 'items', itemLabel: 'value', fields: [
        { key: 'n', label: 'Numeral', type: 'text', help: 'e.g. i.' },
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'desc', label: 'Description', type: 'textarea' },
      ] },
      cta('cta', 'Button'),
    ],
  },

  home_properties: {
    title: 'Homepage — Properties header',
    schema: [
      { key: 'label', label: 'Small label', type: 'text' },
      { key: 'headingHtml', label: 'Heading', type: 'html' },
      cta('cta', 'Button'),
    ],
  },

  home_services: {
    title: 'Homepage — Services intro',
    description: 'The dark "What We Do" panel. The four services themselves are edited under Services.',
    schema: [
      { key: 'label', label: 'Small label', type: 'text' },
      { key: 'headingHtml', label: 'Heading', type: 'html' },
      { key: 'text', label: 'Paragraph', type: 'textarea' },
      cta('cta', 'Button'),
    ],
  },

  home_process: {
    title: 'Homepage — Process label',
    description: 'The four steps themselves are edited under Services → Process steps.',
    schema: [{ key: 'label', label: 'Small label', type: 'text' }],
  },

  home_agent: {
    title: 'Homepage — Agent access section',
    schema: [
      { key: 'label', label: 'Small label', type: 'text' },
      { key: 'headingHtml', label: 'Heading', type: 'html' },
      { key: 'text', label: 'Paragraph', type: 'textarea' },
      { key: 'badge', label: 'Image badge text', type: 'text' },
      img('image', 'Image', 'agent'),
      { key: 'features', label: 'Benefit list', type: 'list', itemLabel: 'benefit' },
      cta('primaryCta', 'Gold button'),
      cta('secondaryCta', 'Outline button'),
    ],
  },

  home_contact: {
    title: 'Homepage — Contact section',
    schema: [
      { key: 'label', label: 'Small label', type: 'text' },
      { key: 'headingHtml', label: 'Heading', type: 'html' },
      { key: 'text', label: 'Paragraph', type: 'textarea' },
      { key: 'interests', label: 'Interest dropdown options', type: 'list', itemLabel: 'option' },
      { key: 'note', label: 'Note under submit button', type: 'text' },
    ],
  },

  nav: {
    title: 'Navigation',
    description: 'Menu items in the header, the mobile menu, and the Enquire button.',
    schema: [
      { key: 'items', label: 'Desktop menu', type: 'items', itemLabel: 'menu item', fields: [
        { key: 'label', label: 'Label', type: 'text' },
        { key: 'href', label: 'Link', type: 'text' },
      ] },
      { key: 'mobileItems', label: 'Mobile menu', type: 'items', itemLabel: 'menu item', fields: [
        { key: 'label', label: 'Label', type: 'text' },
        { key: 'href', label: 'Link', type: 'text' },
      ] },
      cta('cta', 'Header button'),
      { key: 'loaderMeta', label: 'Loading screen caption', type: 'text' },
    ],
  },

  footer: {
    title: 'Footer',
    schema: [
      { key: 'taglineHtml', label: 'Large tagline', type: 'html' },
      { key: 'taglineSub', label: 'Tagline subtext', type: 'textarea' },
      { key: 'blurbHtml', label: 'Blurb under logo', type: 'html' },
      { key: 'companyLinks', label: 'Company links', type: 'items', itemLabel: 'link', fields: [
        { key: 'label', label: 'Label', type: 'text' },
        { key: 'href', label: 'Link', type: 'text' },
      ] },
      { key: 'legalLinks', label: 'Legal links', type: 'items', itemLabel: 'link', fields: [
        { key: 'label', label: 'Label', type: 'text' },
        { key: 'href', label: 'Link', type: 'text' },
      ] },
    ],
  },

  properties_page: {
    title: 'For Sale page',
    schema: [
      { key: 'label', label: 'Small label', type: 'text' },
      { key: 'headingHtml', label: 'Heading', type: 'html' },
      { key: 'introTemplate', label: 'Intro paragraph', type: 'textarea', help: '{count} becomes the number of listings, e.g. "Four"' },
      { key: 'soldLabel', label: 'Sold section label', type: 'text' },
      {
        key: 'cta', label: 'Bottom call-to-action', type: 'object',
        fields: [
          { key: 'label', label: 'Small label', type: 'text' },
          { key: 'headingHtml', label: 'Heading', type: 'html' },
          { key: 'text', label: 'Paragraph', type: 'textarea' },
          cta('primaryCta', 'Gold button'),
          cta('secondaryCta', 'Outline button'),
        ],
      },
    ],
  },

  collection_page: {
    title: 'Collection page',
    description: 'The portfolio gallery of completed residences.',
    schema: [
      { key: 'label', label: 'Small label', type: 'text' },
      { key: 'titleHtml', label: 'Heading', type: 'html' },
      { key: 'text', label: 'Intro paragraph', type: 'textarea' },
      { key: 'items', label: 'Portfolio items', type: 'items', itemLabel: 'residence', fields: [
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'loc', label: 'Location', type: 'text' },
        { key: 'image', label: 'Image', type: 'image', folder: 'collection' },
        { key: 'video', label: 'Hover film (optional)', type: 'file', folder: 'films', accept: 'video/mp4', help: 'plays when a visitor hovers the card' },
      ] },
    ],
  },

  films: {
    title: 'Films',
    description: 'Cinematic reels shown on the homepage and property pages. Vertical (9:16) video works best — your Instagram reels are perfect.',
    schema: [
      {
        key: 'brand', label: 'Homepage film', type: 'object',
        fields: [
          { key: 'label', label: 'Small label', type: 'text' },
          { key: 'headingHtml', label: 'Heading', type: 'html' },
          { key: 'text', label: 'Paragraph', type: 'textarea' },
          { key: 'video', label: 'Video (mp4)', type: 'file', folder: 'films', accept: 'video/mp4' },
          { key: 'poster', label: 'Poster image', type: 'image', folder: 'films', help: 'shown before the film loads' },
        ],
      },
      { key: 'sectionLabel', label: 'Property page section label', type: 'text' },
      {
        key: 'byProperty', label: 'Property films', type: 'object',
        fields: ['qasr', 'solace', 'sierra', 'capri', 'aether'].map((slug) => ({
          key: slug, label: slug.toUpperCase(), type: 'object',
          fields: [
            { key: 'video', label: 'Video (mp4)', type: 'file', folder: 'films', accept: 'video/mp4' },
            { key: 'poster', label: 'Poster image', type: 'image', folder: 'films' },
          ],
        })),
      },
    ],
  },

  legal_privacy: {
    title: 'Privacy Policy',
    schema: [
      { key: 'titleHtml', label: 'Page title', type: 'html' },
      { key: 'updated', label: '"Last updated" text', type: 'text' },
      { key: 'intro', label: 'Introduction', type: 'textarea' },
      { key: 'sections', label: 'Sections', type: 'items', itemLabel: 'section', fields: [
        { key: 'heading', label: 'Heading', type: 'text' },
        { key: 'bodyHtml', label: 'Body', type: 'html' },
      ] },
    ],
  },

  legal_accessibility: {
    title: 'Accessibility Statement',
    schema: [
      { key: 'titleHtml', label: 'Page title', type: 'html' },
      { key: 'updated', label: '"Last updated" text', type: 'text' },
      { key: 'intro', label: 'Introduction', type: 'textarea' },
      { key: 'sections', label: 'Sections', type: 'items', itemLabel: 'section', fields: [
        { key: 'heading', label: 'Heading', type: 'text' },
        { key: 'bodyHtml', label: 'Body', type: 'html' },
      ] },
    ],
  },
};

// Page-document keys that also exist but are edited rarely; they reuse the
// generic editor with these lighter schemas.
contentSchemas.projects_page = {
  title: 'Projects page',
  schema: [
    {
      key: 'hero', label: 'Hero', type: 'object',
      fields: [
        { key: 'image', label: 'Background image', type: 'image', folder: 'pages' },
        { key: 'label', label: 'Small label', type: 'text' },
        { key: 'titleHtml', label: 'Heading', type: 'html' },
        { key: 'sub', label: 'Subtext', type: 'text' },
      ],
    },
    { key: 'currentLabel', label: 'Current section label', type: 'text' },
    { key: 'soldLabel', label: 'Sold section label', type: 'text' },
  ],
};

contentSchemas.services_page = {
  title: 'Services page',
  description: 'Page framing — the four services themselves are edited under Services.',
  schema: [
    {
      key: 'hero', label: 'Hero', type: 'object',
      fields: [
        { key: 'image', label: 'Background image', type: 'image', folder: 'pages' },
        { key: 'label', label: 'Small label', type: 'text' },
        { key: 'titleHtml', label: 'Heading', type: 'html' },
        { key: 'sub', label: 'Subtext', type: 'text' },
      ],
    },
    {
      key: 'intro', label: 'Intro section', type: 'object',
      fields: [
        { key: 'label', label: 'Small label', type: 'text' },
        { key: 'headingHtml', label: 'Heading', type: 'html' },
        { key: 'paragraphs', label: 'Paragraphs', type: 'list', itemType: 'textarea', itemLabel: 'paragraph' },
      ],
    },
    { key: 'processLabel', label: 'Process section label', type: 'text' },
  ],
};

contentSchemas.about_page = {
  title: 'About page',
  schema: [
    {
      key: 'hero', label: 'Hero', type: 'object',
      fields: [
        { key: 'image', label: 'Background image', type: 'image', folder: 'pages' },
        { key: 'label', label: 'Small label', type: 'text' },
        { key: 'titleHtml', label: 'Heading', type: 'html' },
        { key: 'sub', label: 'Subtext', type: 'text' },
      ],
    },
    {
      key: 'mission', label: 'Mission section', type: 'object',
      fields: [
        { key: 'label', label: 'Small label', type: 'text' },
        { key: 'headingHtml', label: 'Heading', type: 'html' },
        { key: 'paragraphs', label: 'Paragraphs', type: 'list', itemType: 'textarea', itemLabel: 'paragraph' },
        { key: 'sigName', label: 'Signature name', type: 'text' },
        { key: 'sigTitle', label: 'Signature title', type: 'text' },
      ],
    },
    {
      key: 'values', label: 'Values', type: 'object',
      fields: [
        { key: 'label', label: 'Small label', type: 'text' },
        { key: 'items', label: 'Values', type: 'items', itemLabel: 'value', fields: [
          { key: 'n', label: 'Numeral', type: 'text' },
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'desc', label: 'Description', type: 'textarea' },
        ] },
      ],
    },
    {
      key: 'journey', label: 'Timeline', type: 'object',
      fields: [
        { key: 'label', label: 'Small label', type: 'text' },
        { key: 'headingHtml', label: 'Heading', type: 'html' },
        { key: 'text', label: 'Intro text', type: 'textarea' },
        { key: 'items', label: 'Milestones', type: 'items', itemLabel: 'milestone', fields: [
          { key: 'year', label: 'Year', type: 'text' },
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'desc', label: 'Description', type: 'textarea' },
        ] },
      ],
    },
    {
      key: 'awards', label: 'Awards', type: 'object',
      fields: [
        { key: 'label', label: 'Small label', type: 'text' },
        { key: 'headingHtml', label: 'Heading', type: 'html' },
        { key: 'items', label: 'Awards', type: 'items', itemLabel: 'award', fields: [
          { key: 'year', label: 'Year', type: 'text' },
          { key: 'title', label: 'Award', type: 'text' },
          { key: 'org', label: 'Awarding body', type: 'text' },
        ] },
      ],
    },
  ],
};

contentSchemas.agent_page = {
  title: 'Agent Access page',
  schema: [
    {
      key: 'hero', label: 'Hero', type: 'object',
      fields: [
        { key: 'image', label: 'Background image', type: 'image', folder: 'pages' },
        { key: 'label', label: 'Small label', type: 'text' },
        { key: 'titleHtml', label: 'Heading', type: 'html' },
        { key: 'text', label: 'Subtext', type: 'textarea' },
      ],
    },
    {
      key: 'benefits', label: 'Benefits', type: 'object',
      fields: [
        { key: 'label', label: 'Small label', type: 'text' },
        { key: 'headingHtml', label: 'Heading', type: 'html' },
        { key: 'items', label: 'Benefit cards', type: 'items', itemLabel: 'benefit', fields: [
          { key: 'icon', label: 'Icon', type: 'select', options: ['layers', 'plan', 'phone', 'dollar', 'users', 'star'] },
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'desc', label: 'Description', type: 'textarea' },
        ] },
      ],
    },
    {
      key: 'apply', label: 'Application form section', type: 'object',
      fields: [
        { key: 'label', label: 'Small label', type: 'text' },
        { key: 'headingHtml', label: 'Heading', type: 'html' },
        { key: 'text', label: 'Paragraph', type: 'textarea' },
        { key: 'noteLabel', label: 'Note label', type: 'text' },
        { key: 'noteText', label: 'Note text', type: 'textarea' },
        { key: 'submitLabel', label: 'Submit button text', type: 'text' },
      ],
    },
  ],
};

contentSchemas.contact_page = {
  title: 'Contact page',
  schema: [
    {
      key: 'hero', label: 'Hero', type: 'object',
      fields: [
        { key: 'label', label: 'Small label', type: 'text' },
        { key: 'titleHtml', label: 'Heading', type: 'html' },
        { key: 'text', label: 'Subtext', type: 'textarea' },
      ],
    },
    {
      key: 'form', label: 'Form', type: 'object',
      fields: [
        { key: 'label', label: 'Small label', type: 'text' },
        { key: 'interests', label: 'Extra dropdown options', type: 'list', itemLabel: 'option', help: 'current for-sale properties are added automatically' },
        { key: 'submitLabel', label: 'Submit button text', type: 'text' },
        { key: 'note', label: 'Note next to button', type: 'text' },
      ],
    },
    {
      key: 'map', label: 'Map / location image', type: 'object',
      fields: [
        { key: 'image', label: 'Image', type: 'image', folder: 'pages' },
        { key: 'label', label: 'Caption', type: 'text' },
      ],
    },
  ],
};

contentSchemas.notfound = {
  title: '404 page',
  schema: [
    { key: 'titleHtml', label: 'Heading', type: 'html' },
    { key: 'text', label: 'Paragraph', type: 'textarea' },
    cta('primaryCta', 'Gold button'),
    cta('secondaryCta', 'Outline button'),
  ],
};

/** Groups shown on the Content index page. */
export const contentGroups = [
  { name: 'Homepage', keys: ['home_hero', 'home_stats', 'home_marquee', 'home_about', 'home_properties', 'home_services', 'home_process', 'home_agent', 'home_contact'] },
  { name: 'Pages', keys: ['properties_page', 'projects_page', 'services_page', 'about_page', 'collection_page', 'agent_page', 'contact_page', 'notfound'] },
  { name: 'Site-wide', keys: ['films', 'nav', 'footer', 'legal_privacy', 'legal_accessibility'] },
];

/** Property editor schema (columns of the properties table). */
export const propertySchema = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'slug', label: 'Web address', type: 'text', help: 'lowercase, no spaces — becomes /properties/<this>/' },
  { key: 'status', label: 'Status', type: 'select', options: [['for-sale', 'For Sale'], ['sold', 'Sold Prior to Completion']] },
  { key: 'published', label: 'Visibility', type: 'checkbox', checkLabel: 'Published — visible on the website' },
  { key: 'display_order', label: 'Display order', type: 'number', help: 'lower numbers appear first' },
  { key: 'suburb', label: 'Suburb', type: 'text' },
  { key: 'state', label: 'State', type: 'text' },
  { key: 'year', label: 'Year', type: 'number' },
  { key: 'beds', label: 'Bedrooms', type: 'number' },
  { key: 'baths', label: 'Bathrooms', type: 'number' },
  { key: 'cars', label: 'Garage spaces', type: 'number' },
  { key: 'land', label: 'Land size (m²)', type: 'number' },
  { key: 'land_over', label: 'Land size is a minimum', type: 'checkbox', checkLabel: 'Show as e.g. 1000m²+' },
  { key: 'image', label: 'Hero image', type: 'image', folder: 'properties' },
  { key: 'headline', label: 'Page headline', type: 'html', help: 'use <em>…</em> for gold italics and <br> for a line break' },
  { key: 'description', label: 'Description', type: 'textarea', help: 'blank line between paragraphs' },
  { key: 'seo_description', label: 'Search engine description', type: 'textarea' },
  { key: 'features', label: 'Key features', type: 'list', itemLabel: 'feature' },
  { key: 'gallery', label: 'Gallery', type: 'items', itemLabel: 'photo', fields: [
    { key: 'src', label: 'Image', type: 'image', folder: 'properties' },
    { key: 'alt', label: 'Alt text', type: 'text' },
  ] },
  { key: 'enquiry_heading', label: 'Enquiry box heading', type: 'text' },
  { key: 'enquiry_text', label: 'Enquiry box text', type: 'textarea' },
  { key: 'enquiry_button', label: 'Enquiry button text', type: 'text' },
  { key: 'brochure_url', label: 'Brochure (PDF)', type: 'file', folder: 'brochures', accept: 'application/pdf' },
  {
    key: 'viewer_type', label: '3D viewer', type: 'select',
    options: [['none', 'None'], ['model', '3D model (GLB file)'], ['tour', 'Virtual tour (Matterport / 360°)']],
  },
  { key: 'model_url', label: '3D model file (.glb)', type: 'file', folder: 'models', accept: '.glb,.gltf,model/gltf-binary' },
  { key: 'poster_url', label: '3D viewer poster image', type: 'image', folder: 'models', help: 'shown while the model loads' },
  { key: 'tour_url', label: 'Virtual tour link', type: 'text', help: 'the embed URL from Matterport or similar' },
];
