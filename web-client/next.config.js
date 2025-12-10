/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
        NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000',
    },
    webpack: (config) => {
        // Fallback for resolving path aliases if tsconfig fails in production
        const path = require('path');
        config.resolve.alias['@'] = path.join(__dirname, 'src');
        return config;
    },
}

module.exports = nextConfig
