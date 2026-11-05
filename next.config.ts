import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  distDir: ".next",
  output: "standalone",
  pageExtensions: ["js", "jsx", "ts", "tsx"],
  partialPrefetching: true,
  reactCompiler: true,
  reactStrictMode: false,

  // `pg` talks to PostgreSQL over TCP from the Node runtime; keep it out of the bundle.
  serverExternalPackages: ["pg"],

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
