import { expect } from 'chai'
import HumanReadableLogs from '../../../../frontend/js/ide/human-readable-logs/HumanReadableLogs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { some } from 'lodash'

const fixturePath = '../../helpers/fixtures/logs/'

async function parse(fixtureName) {
  const filePath = join(__dirname, fixturePath, fixtureName)
  const data = await readFile(filePath, 'utf-8', 'r')
  return HumanReadableLogs.parse(data)
}

describe('HumanReadableLogs', function () {
  describe('Undefined commands', function () {
    before(async function () {
      this.errors = (await parse('undefined-control-sequence.log')).errors
    })

    describe('For unknown commands', function () {
      it('Identifies command at beginning of line', function () {
        expect(
          some(this.errors, {
            line: 3,
            level: 'error',
            message: 'Undefined control sequence.',
          })
        ).to.be.true
      })
      it('Identifies command at end of line', function () {
        expect(
          some(this.errors, {
            line: 4,
            level: 'error',
            message: 'Undefined control sequence.',
          })
        ).to.be.true
      })
      it('Identifies command inside argument', function () {
        expect(
          some(this.errors, {
            line: 5,
            level: 'error',
            message: 'Undefined control sequence.',
          })
        ).to.be.true
      })
    })

    describe('For known commands', function () {
      it('Identifies command at beginning of line', function () {
        expect(
          some(this.errors, {
            line: 6,
            level: 'error',
            message: 'Is \\usepackage{url} missing?',
          })
        ).to.be.true
      })
      it('Identifies command at end of line', function () {
        expect(
          some(this.errors, {
            line: 7,
            level: 'error',
            message: 'Is \\usepackage{amsmath} missing?',
          })
        ).to.be.true
      })
      it('Identifies command inside argument', function () {
        expect(
          some(this.errors, {
            line: 8,
            level: 'error',
            message: 'Is \\usepackage{array} missing?',
          })
        ).to.be.true
      })
    })
  })
})
