import { expect } from 'chai'
import {
  getFileExtension,
  hasImageExtension,
  isSvgFile,
} from '../../../../../frontend/js/features/source-editor/utils/file'

describe('file utilities', function () {
  describe('getFileExtension', function () {
    ;[
      ['image.png', 'png'],
      ['image.PNG', 'png'],
      ['folder/subfolder/image.SVG', 'svg'],
      ['my.file.name.jpg', 'jpg'],
      ['filename', null],
      ['.gitignore.txt', 'txt'],
    ].forEach(([input, expected]) => {
      it(`returns correct extension for "${input}"`, function () {
        expect(getFileExtension(input as string)).to.equal(expected)
      })
    })
  })

  describe('hasImageExtension', function () {
    ;['png', 'jpg', 'jpeg', 'pdf', 'eps', 'svg'].forEach(ext => {
      it(`returns true for .${ext} files (including nested and uppercase)`, function () {
        expect(hasImageExtension(`image.${ext}`)).to.equal(true)
        expect(hasImageExtension(`image.${ext.toUpperCase()}`)).to.equal(true)
        expect(hasImageExtension(`folder/image.${ext}`)).to.equal(true)
      })
    })

    it('returns false for non-image files', function () {
      expect(hasImageExtension('document.tex')).to.equal(false)
      expect(hasImageExtension('README')).to.equal(false)
    })
  })

  describe('isSvgFile', function () {
    it('returns true for svg files (including nested and uppercase)', function () {
      expect(isSvgFile('diagram.svg')).to.equal(true)
      expect(isSvgFile('diagram.SVG')).to.equal(true)
      expect(isSvgFile('figures/diagram.svg')).to.equal(true)
    })

    it('returns false for non-svg files', function () {
      expect(isSvgFile('image.png')).to.equal(false)
      expect(isSvgFile('svgfile')).to.equal(false)
      expect(isSvgFile('svg-diagram.png')).to.equal(false)
    })
  })
})
