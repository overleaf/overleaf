import sinon from 'sinon'
import { expect } from 'vitest'
import CollaboratorsInviteHelper from '../../../../app/src/Features/Collaborators/CollaboratorsInviteHelper.mjs'
import Crypto from 'node:crypto'

describe('CollaboratorsInviteHelper', function () {
  it('should generate a HMAC token', function () {
    const CryptoCreateHmac = sinon.spy(Crypto, 'createHmac')
    const tokenHmac = CollaboratorsInviteHelper.hashInviteToken('abc')
    CryptoCreateHmac.callCount.should.equal(1)
    expect(tokenHmac).to.eq(
      '3f76e274d83ffba85149f6850c095ce8481454d7446ca4e25beee01e08beb383'
    )
  })
})
