import { beforeAll, describe, it, expect } from 'vitest'
import { fetchStringWithResponse } from '@overleaf/fetch-utils'
import app from '../../../app.ts'
import logger from '@overleaf/logger'
import './MongoHelper.ts'

let runAppPromise: Promise<void> | null = null

async function ensureRunning(hostname: string, port: number) {
  if (!runAppPromise) {
    runAppPromise = new Promise(resolve => {
      app.listen(port, hostname, () => {
        logger.info({ port, hostname }, 'notifications running in dev mode')

        resolve()
      })
    })
  }
  await runAppPromise
}

describe('HealthCheck endpoint', () => {
  beforeAll(async () => {
    await ensureRunning('127.0.0.1', 3042)
  })
  it('should return 200 for GET /health_check', async () => {
    const { response } = await fetchStringWithResponse(
      'http://localhost:3042/health_check'
    )
    expect(response.status).toBe(200)
  })
})
