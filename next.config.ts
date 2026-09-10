import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El repo vive en una subcarpeta; fijar la raíz evita que Turbopack tome
  // el package-lock.json de C:\Users\Admin.
  turbopack: { root: __dirname },
};

export default nextConfig;
