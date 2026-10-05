/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pre-/[network] routes. Temporary (307) while the layout settles.
  async redirects() {
    return [
      { source: "/", destination: "/mainnet", permanent: false },
      { source: "/about", destination: "/learn/how-it-works", permanent: false },
      { source: "/testnet/my-node", destination: "/testnet/claim", permanent: false },
    ];
  },
};

export default nextConfig;
