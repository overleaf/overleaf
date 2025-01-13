import { expect } from 'chai'
import { cleanURL } from '@/shared/utils/url-helper'

describe('url-helper', function () {
  describe('cleanURL', function () {
    describe('without mode', function () {
      it('removes trailing slash', function () {
        const url = new URL('https://www.ovelreaf.com/project/1abc/')
        expect(cleanURL(url).href).to.equal(
          'https://www.ovelreaf.com/project/1abc'
        )
      })

      it('clears the mode from the detached URL', function () {
        const url = new URL('https://www.ovelreaf.com/project/2abc/detached')
        expect(cleanURL(url).href).to.equal(
          'https://www.ovelreaf.com/project/2abc'
        )
      })

      it('clears the mode from the detacher URL', function () {
        const url = new URL('https://www.ovelreaf.com/project/2abc/detacher/')
        expect(cleanURL(url).href).to.equal(
          'https://www.ovelreaf.com/project/2abc'
        )
      })
    })

    describe('with mode', function () {
      it('handles with trailing slash', function () {
        const url = new URL('https://www.ovelreaf.com/project/3abc/')
        expect(cleanURL(url, 'detacher').href).to.equal(
          'https://www.ovelreaf.com/project/3abc/detacher'
        )
      })

      it('handles without trailing slash', function () {
        const url = new URL('https://www.ovelreaf.com/project/4abc')
        expect(cleanURL(url, 'detached').href).to.equal(
          'https://www.ovelreaf.com/project/4abc/detached'
        )
      })
    })
  })
})
