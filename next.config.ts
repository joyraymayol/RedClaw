import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets phones/tablets on the same Wi-Fi reach `next dev` via LAN IP
  // (e.g. http://192.168.0.104:3000) for on-device testing. Without this,
  // Next.js blocks cross-origin dev requests (JS chunks, HMR socket) from
  // any host other than localhost, so the page renders but never hydrates —
  // buttons look normal but don't respond to taps. Dev-only; unused in prod.
  allowedDevOrigins: ["192.168.0.*", "10.10.50.197", "Jojis-MacBook-Pro.local"],
};

export default nextConfig;
