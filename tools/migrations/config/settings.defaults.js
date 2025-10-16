module.exports = {
  mongo: {
    options: {
      appname: 'migrations',
      maxPoolSize: parseInt(process.env.MONGO_POOL_SIZE, 10) || 100,
      serverSelectionTimeoutMS:
        parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT, 10) || 60000,
      // Setting socketTimeoutMS to 0 means no timeout
      socketTimeoutMS: parseInt(
        process.env.MONGO_SOCKET_TIMEOUT ?? '60000',
        10
      ),
      monitorCommands: true,
    },
    url:
      process.env.MONGO_CONNECTION_STRING ||
      process.env.MONGO_URL ||
      `mongodb://${process.env.MONGO_HOST || '127.0.0.1'}/sharelatex`,
    hasSecondaries: process.env.MONGO_HAS_SECONDARIES === 'true',
  },
}
