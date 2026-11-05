import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/app', '/admin', '/share/'],
    },
    sitemap: 'https://orbit.chat/sitemap.xml',
  };
}

