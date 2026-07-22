import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // geoip-lite loads its GeoIP .dat files from its own package dir at runtime;
  // keep it external so Next doesn't bundle it (which would break those paths).
  serverExternalPackages: ["geoip-lite"],
};

export default nextConfig;
