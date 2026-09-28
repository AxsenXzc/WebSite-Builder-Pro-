import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/util/site-url";

/** Aree che non hanno senso nei motori di ricerca: sessioni, API, studio. */
const PRIVATE_PATHS = ["/api/", "/login", "/dashboard", "/nuovo", "/studio", "/impostazioni", "/stato"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
