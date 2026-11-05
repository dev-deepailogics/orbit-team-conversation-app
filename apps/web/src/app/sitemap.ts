import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://orbit.chat';
  const currentDate = new Date().toISOString();

  const routes = [
    '',
    '/features',
    '/whats-new',
    '/pricing',
    '/about',
    '/blog',
    '/contact',
    '/privacy',
    '/terms',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: currentDate,
    changeFrequency: route === '' || route === '/whats-new' ? 'daily' : 'weekly',
    priority: route === '' ? 1.0 : route === '/features' || route === '/pricing' ? 0.9 : 0.7,
  }));
}

