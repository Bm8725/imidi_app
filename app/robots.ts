import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/cloud-db", "/terms"], // Blochează scanarea fișierelor de sistem și a rutelor private
    },
    sitemap: "https://imidi.co.uk", // Corectat: adăugat /sitemap.xml la final
  };
}
