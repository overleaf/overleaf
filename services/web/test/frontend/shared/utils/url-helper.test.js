import { expect } from 'chai'
import sinon from 'sinon'
import { buildUrlWithDetachRole } from '../../../../frontend/js/shared/utils/url-helper'

describe('url-helper', function () {
  let locationStub
  describe('buildUrlWithDetachRole', function () {
    beforeEach(function () {
      locationStub = sinon.stub(window, 'location')
    })

    afterEach(function () {
      locationStub.restore()
    })

    describe('without mode', function () {
      it('removes trailing slash', function () {
        locationStub.value('https://www.ovelreaf.com/project/1abc/')
        expect(buildUrlWithDetachRole().href).to.equal(
          'https://www.ovelreaf.com/project/1abc'
        )
      })

      it('clears the mode from the current URL', function () {
        locationStub.value('https://www.ovelreaf.com/project/2abc/detached')
        expect(buildUrlWithDetachRole().href).to.equal(
          'https://www.ovelreaf.com/project/2abc'
        )

        locationStub.value('https://www.ovelreaf.com/project/2abc/detacher/')
        expect(buildUrlWithDetachRole().href).to.equal(
          'https://www.ovelreaf.com/project/2abc'
        )
      })
    })

    describe('with mode', function () {
      it('handles with trailing slash', function () {
        locationStub.value('https://www.ovelreaf.com/project/3abc/')
        expect(buildUrlWithDetachRole('detacher').href).to.equal(
          'https://www.ovelreaf.com/project/3abc/detacher'
        )
      })

      it('handles without trailing slash', function () {
        locationStub.value('https://www.ovelreaf.com/project/4abc')
        expect(buildUrlWithDetachRole('detached').href).to.equal(
          'https://www.ovelreaf.com/project/4abc/detached'
        )
      })
    })
  })
})
