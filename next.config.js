/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev, isServer }) => {
    // Configure webpack cache to reduce serialization warnings
    if (config.cache && typeof config.cache === 'object') {
      config.cache.buildDependencies = config.cache.buildDependencies || {}
      config.cache.buildDependencies.config = [__filename]
      
      // Enable compression and set cache limits to reduce large string warnings
      if (config.cache.type === 'filesystem') {
        config.cache.compression = 'gzip'
        config.cache.maxAge = 1000 * 60 * 60 * 24 * 7 // 1 week
        config.cache.maxMemoryGenerations = 1
      }
    }

    // Optimize for third-party modules causing large string serialization
    config.optimization = config.optimization || {}
    config.optimization.moduleIds = 'deterministic'
    
    // Reduce serialization impact for large modules
    config.resolve = config.resolve || {}
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      crypto: false
    }
    
    // Exclude scripts directory from webpack processing
    config.watchOptions = config.watchOptions || {}
    const existingIgnored = config.watchOptions.ignored || []
    config.watchOptions.ignored = Array.isArray(existingIgnored) 
      ? [...existingIgnored, '**/scripts/**/*']
      : ['**/scripts/**/*']

    return config
  }
}

module.exports = nextConfig