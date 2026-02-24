const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@stellar/design-system'],
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: [
        {
          loader: '@svgr/webpack',
          options: {
            typescript: true,
            ext: 'tsx',
            exportType: 'named',
            namedExport: 'ReactComponent',
          },
        },
      ],
    })

    return config
  },
}

module.exports = nextConfig
