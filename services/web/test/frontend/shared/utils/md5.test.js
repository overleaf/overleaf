import { expect } from 'chai'

import { generateMD5Hash } from '@/shared/utils/md5'

describe('md5', function () {
  describe('generateSHA1Hash', function () {
    it('sample string 1', function () {
      expect(generateMD5Hash('sample string 1')).to.equal(
        'b7988250a49c21459260b41d2b435dae'
      )
    })

    it('sample string 2', function () {
      expect(generateMD5Hash('sample string 2')).to.equal(
        '371b9c84c640a9e121523156aeae4958'
      )
    })
  })
})
