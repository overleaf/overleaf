import { describe, it, expect } from 'vitest'
import { bucketFileParamsSchema } from '../../../app/js/schemas.js'

describe('schemas', function () {
  describe('bucketFileParamsSchema', function () {
    it('accepts a well-formed bucket name', function () {
      const result = bucketFileParamsSchema.safeParse({
        params: { bucket: 'my-bucket-123', key: 'some/key' },
      })
      expect(result.success).to.equal(true)
    })

    it('rejects a bucket name with disallowed characters', function () {
      const result = bucketFileParamsSchema.safeParse({
        params: { bucket: 'My_Bucket!', key: 'some/key' },
      })
      expect(result.success).to.equal(false)
    })

    it('rejects an empty bucket name', function () {
      const result = bucketFileParamsSchema.safeParse({
        params: { bucket: '', key: 'some/key' },
      })
      expect(result.success).to.equal(false)
    })
  })
})
