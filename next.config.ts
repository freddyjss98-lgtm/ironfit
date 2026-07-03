import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "knygkpawixvacdiqpbwn.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // El dominio antiguo (ironfitclub.vercel.app) fue compartido antes de tener
  // dominio propio. Redirigimos permanentemente todo su tráfico al dominio final.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "ironfitclub.vercel.app" }],
        destination: "https://www.ironfitclub.org/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
