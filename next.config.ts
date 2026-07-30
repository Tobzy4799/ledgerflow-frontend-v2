import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // RainbowKit's default wallet list pulls in Coinbase's CDP SDK, which has
    // an optional dependency on an experimental x402 payment protocol we never
    // actually use. These specific sub-packages are missing/broken, but since
    // we never execute this code path (no Coinbase Wallet / Base Account
    // usage in our app), it's safe to tell webpack to treat them as empty.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/core/client": false,
      "@x402/evm": false,
      "@x402/evm/exact/client": false,
      "@x402/evm/upto/client": false,
      "@x402/svm/exact/client": false,
    };
    return config;
  },
};

export default nextConfig;