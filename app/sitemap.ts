import type { MetadataRoute } from "next";
import { site } from "./content";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const sections = [
    "",
    "#servicios",
    "#horarios",
    "#filosofia",
    "#galeria",
    "#ubicacion",
    "#contacto",
  ];

  return sections.map((hash, i) => ({
    url: `${site.url}/${hash}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: i === 0 ? 1 : 0.7,
  }));
}
