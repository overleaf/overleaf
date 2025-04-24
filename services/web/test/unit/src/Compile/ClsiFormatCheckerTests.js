/* eslint-disable
    n/handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/src/Features/Compile/ClsiFormatChecker.js'
const SandboxedModule = require('sandboxed-module')

describe('ClsiFormatChecker', function () {
  beforeEach(function () {
    this.ClsiFormatChecker = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': (this.settings = {
          compileBodySizeLimitMb: 5,
        }),
      },
    })
    return (this.project_id = 'project-id')
  })

  describe('checkRecoursesForProblems', function () {
    beforeEach(function () {
      return (this.resources = [
        {
          path: 'main.tex',
          content: 'stuff',
        },
        {
          path: 'chapters/chapter1',
          content: 'other stuff',
        },
        {
          path: 'stuff/image/image.png',
          url: `http:somewhere.com/project/${this.project_id}/file/1234124321312`,
          modified: 'more stuff',
        },
      ])
    })

    it('should call _checkDocsAreUnderSizeLimit and _checkForConflictingPaths', async function () {
      this.ClsiFormatChecker._checkForConflictingPaths = sinon
        .stub()
        .callsArgWith(1, null)
      this.ClsiFormatChecker._checkDocsAreUnderSizeLimit = sinon
        .stub()
        .callsArgWith(1)
      const problems =
        await this.ClsiFormatChecker.promises.checkRecoursesForProblems(
          this.resources
        )
      this.ClsiFormatChecker._checkForConflictingPaths.called.should.equal(true)
      this.ClsiFormatChecker._checkDocsAreUnderSizeLimit.called.should.equal(
        true
      )
    })

    it('should remove undefined errors', async function () {
      this.ClsiFormatChecker._checkForConflictingPaths = sinon
        .stub()
        .callsArgWith(1, null, [])
      this.ClsiFormatChecker._checkDocsAreUnderSizeLimit = sinon
        .stub()
        .callsArgWith(1, null, {})
      const problems =
        await this.ClsiFormatChecker.promises.checkRecoursesForProblems(
          this.resources
        )
      expect(problems).to.not.exist
    })

    it('should keep populated arrays', async function () {
      this.ClsiFormatChecker._checkForConflictingPaths = sinon
        .stub()
        .callsArgWith(1, null, [{ path: 'somewhere/main.tex' }])
      this.ClsiFormatChecker._checkDocsAreUnderSizeLimit = sinon
        .stub()
        .callsArgWith(1, null, {})
      const problems =
        await this.ClsiFormatChecker.promises.checkRecoursesForProblems(
          this.resources
        )
      problems.conflictedPaths[0].path.should.equal('somewhere/main.tex')
      expect(problems.sizeCheck).to.not.exist
    })

    it('should keep populated object', async function () {
      this.ClsiFormatChecker._checkForConflictingPaths = sinon
        .stub()
        .callsArgWith(1, null, [])
      this.ClsiFormatChecker._checkDocsAreUnderSizeLimit = sinon
        .stub()
        .callsArgWith(1, null, {
          resources: [{ 'a.tex': 'a.tex' }, { 'b.tex': 'b.tex' }],
          totalSize: 1000000,
        })
      const problems =
        await this.ClsiFormatChecker.promises.checkRecoursesForProblems(
          this.resources
        )
      problems.sizeCheck.resources.length.should.equal(2)
      problems.sizeCheck.totalSize.should.equal(1000000)
      expect(problems.conflictedPaths).to.not.exist
    })

    describe('_checkForConflictingPaths', function () {
      beforeEach(function () {
        this.resources.push({
          path: 'chapters/chapter1.tex',
          content: 'other stuff',
        })

        return this.resources.push({
          path: 'chapters.tex',
          content: 'other stuff',
        })
      })

      it('should flag up when a nested file has folder with same subpath as file elsewhere', async function () {
        this.resources.push({
          path: 'stuff/image',
          url: 'http://somwhere.com',
        })

        const conflictPathErrors =
          await this.ClsiFormatChecker.promises._checkForConflictingPaths(
            this.resources
          )
        conflictPathErrors.length.should.equal(1)
        conflictPathErrors[0].path.should.equal('stuff/image')
      })

      it('should flag up when a root level file has folder with same subpath as file elsewhere', async function () {
        this.resources.push({
          path: 'stuff',
          content: 'other stuff',
        })

        const conflictPathErrors =
          await this.ClsiFormatChecker.promises._checkForConflictingPaths(
            this.resources
          )
        conflictPathErrors.length.should.equal(1)
        conflictPathErrors[0].path.should.equal('stuff')
      })

      it('should not flag up when the file is a substring of a path', async function () {
        this.resources.push({
          path: 'stuf',
          content: 'other stuff',
        })

        const conflictPathErrors =
          await this.ClsiFormatChecker.promises._checkForConflictingPaths(
            this.resources
          )
        conflictPathErrors.length.should.equal(0)
      })
    })

    describe('_checkDocsAreUnderSizeLimit', function () {
      it('should error when there is more than 5mb of data', async function () {
        this.resources.push({
          path: 'massive.tex',
          content: 'hello world'.repeat(833333), // over 5mb limit
        })

        while (this.resources.length < 20) {
          this.resources.push({
            path: 'chapters/chapter1.tex',
            url: 'http://somwhere.com',
          })
        }

        const sizeError =
          await this.ClsiFormatChecker.promises._checkDocsAreUnderSizeLimit(
            this.resources
          )
        sizeError.totalSize.should.equal(16 + 833333 * 11) // 16 is for earlier resources
        sizeError.resources.length.should.equal(10)
        sizeError.resources[0].path.should.equal('massive.tex')
        sizeError.resources[0].size.should.equal(833333 * 11)
      })

      it('should return nothing when project is correct size', async function () {
        this.resources.push({
          path: 'massive.tex',
          content: 'x'.repeat(2 * 1000 * 1000),
        })

        while (this.resources.length < 20) {
          this.resources.push({
            path: 'chapters/chapter1.tex',
            url: 'http://somwhere.com',
          })
        }

        const sizeError =
          await this.ClsiFormatChecker.promises._checkDocsAreUnderSizeLimit(
            this.resources
          )
        expect(sizeError).to.not.exist
      })
    })
  })
})
