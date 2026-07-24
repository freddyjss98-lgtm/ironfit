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
  // dominio propio. Redirigimos permanentemente su tráfico al dominio final,
  // EXCEPTO /api/*: hay integraciones externas registradas contra el dominio
  // viejo (el webhook de WhatsApp en Meta) y Meta no sigue redirecciones —
  // un 308 le cuenta como entrega fallida y el bot se queda mudo.
  async redirects() {
    return [
      {
        source: "/:path((?!api/).*)",
        has: [{ type: "host", value: "ironfitclub.vercel.app" }],
        destination: "https://www.ironfitclub.org/:path",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
