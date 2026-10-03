import type { APIRoute } from "astro";

const pages = ["", "research", "misc", "contact"];

export const GET: APIRoute = ({ site }) => {
  const urls = pages
    .map((page) => `  <url><loc>${new URL(page, site)}</loc></url>`)
    .join("\n");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
};