import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('Settings', function () {
  describe('s3', function () {
    const s3Settings = {
      bucket1: {
        auth_key: 'bucket1_key',
        auth_secret: 'bucket1_secret',
      },
    }
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    beforeEach(() => {
      vi.stubEnv()
      process.env.S3_BUCKET_CREDENTIALS = JSON.stringify(s3Settings)
    })
    it('should use JSONified env var if present', async function () {
      const settings = (await import('@overleaf/settings')).default
      expect(settings.filestore.s3.bucketCreds).to.deep.equal(s3Settings)
    })
  })
})
