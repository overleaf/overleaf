module.exports = {
  internal: {
    notifications: {
      port: 3042,
      host: process.env.LISTEN_ADDRESS || 'localhost'
    }
  },

  mongo: {
    options: {
      useUnifiedTopology:
        (process.env.MONGO_USE_UNIFIED_TOPOLOGY || 'true') === 'true'
    },
    url:
      process.env.MONGO_CONNECTION_STRING ||
      `mongodb://${process.env.MONGO_HOST || 'localhost'}/sharelatex`
  }
}
