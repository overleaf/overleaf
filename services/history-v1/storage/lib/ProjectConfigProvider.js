const { MongoClient, ObjectId } = require('mongodb')
const config = require('config')
const logger = require('@overleaf/logger')

class ProjectConfigProvider {
    constructor() {
        this.db = null
        const mongoConfig = config.get('mongo')
        this.client = new MongoClient(mongoConfig.uri)
    }

    async connect() {
        try {
            await this.client.connect()
            this.db = this.client.db()
            logger.info('ProjectConfigProvider connected to MongoDB')
        } catch (err) {
            logger.error({ err }, 'ProjectConfigProvider failed to connect to MongoDB')
            throw err
        }
    }

    async getWebDAVConfig(projectId) {
        if (!this.db) {
            await this.connect()
        }

        try {
            const project = await this.db.collection('projects').findOne(
                { _id: new ObjectId(projectId) },
                { projection: { webdavConfig: 1 } }
            )
            return project ? project.webdavConfig : null
        } catch (err) {
            logger.warn({ err, projectId }, 'Error fetching project config')
            return null
        }
    }

    async close() {
        if (this.client) {
            await this.client.close()
        }
    }
}

module.exports = new ProjectConfigProvider()
