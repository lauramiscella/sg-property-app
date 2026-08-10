import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Don't let other sites embed the app (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          // Browsers must respect declared content types.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Don't leak full URLs to third parties.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // No sensors/mic/camera needed anywhere.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
