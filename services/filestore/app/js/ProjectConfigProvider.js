import { MongoClient, ObjectId } from 'mongodb'
import Settings from '@overleaf/settings'
import Logger from '@overleaf/logger'

class ProjectConfigProvider {
    constructor() {
        this.db = null
        const { url } = Settings.mongo
        this.client = new MongoClient(url)
    }

    async connect() {
        try {
            await this.client.connect()
            this.db = this.client.db()
            Logger.info('Connected to MongoDB')
        } catch (err) {
            Logger.error({ err }, 'Failed to connect to MongoDB')
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
            Logger.warn({ err, projectId }, 'Error fetching project config')
            return null
        }
    }

    async close() {
        if (this.client) {
            await this.client.close()
        }
    }
}

export default new ProjectConfigProvider()
