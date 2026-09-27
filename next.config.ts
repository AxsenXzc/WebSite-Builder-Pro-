import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Il sito generato viene renderizzato in una route isolata e servito nell'iframe
  // di anteprima dell'editor: nessun bundler aggiuntivo, solo HTML/CSS statico.
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
