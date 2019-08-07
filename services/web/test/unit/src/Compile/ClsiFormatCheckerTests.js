/* eslint-disable
    handle-callback-err,
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
const chai = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath = '../../../../app/src/Features/Compile/ClsiFormatChecker.js'
const SandboxedModule = require('sandboxed-module')

describe('ClsiFormatChecker', function() {
  beforeEach(function() {
    this.ClsiFormatChecker = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': (this.settings = { compileBodySizeLimitMb: 5 }),
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          error: sinon.stub(),
          warn: sinon.stub()
        })
      }
    })
    return (this.project_id = 'project-id')
  })

  describe('checkRecoursesForProblems', function() {
    beforeEach(function() {
      return (this.resources = [
        {
          path: 'main.tex',
          content: 'stuff'
        },
        {
          path: 'chapters/chapter1',
          content: 'other stuff'
        },
        {
          path: 'stuff/image/image.png',
          url: `http:somewhere.com/project/${
            this.project_id
          }/file/1234124321312`,
          modified: 'more stuff'
        }
      ])
    })

    it('should call _checkForDuplicatePaths and _checkForConflictingPaths', function(done) {
      this.ClsiFormatChecker._checkForConflictingPaths = sinon
        .stub()
        .callsArgWith(1, null)
      this.ClsiFormatChecker._checkDocsAreUnderSizeLimit = sinon
        .stub()
        .callsArgWith(1)
      return this.ClsiFormatChecker.checkRecoursesForProblems(
        this.resources,
        (err, problems) => {
          this.ClsiFormatChecker._checkForConflictingPaths.called.should.equal(
            true
          )
          this.ClsiFormatChecker._checkDocsAreUnderSizeLimit.called.should.equal(
            true
          )
          return done()
        }
      )
    })

    it('should remove undefined errors', function(done) {
      this.ClsiFormatChecker._checkForConflictingPaths = sinon
        .stub()
        .callsArgWith(1, null, [])
      this.ClsiFormatChecker._checkDocsAreUnderSizeLimit = sinon
        .stub()
        .callsArgWith(1, null, {})
      return this.ClsiFormatChecker.checkRecoursesForProblems(
        this.resources,
        (err, problems) => {
          expect(problems).to.not.exist
          expect(problems).to.not.exist
          return done()
        }
      )
    })

    it('should keep populated arrays', function(done) {
      this.ClsiFormatChecker._checkForConflictingPaths = sinon
        .stub()
        .callsArgWith(1, null, [{ path: 'somewhere/main.tex' }])
      this.ClsiFormatChecker._checkDocsAreUnderSizeLimit = sinon
        .stub()
        .callsArgWith(1, null, {})
      return this.ClsiFormatChecker.checkRecoursesForProblems(
        this.resources,
        (err, problems) => {
          problems.conflictedPaths[0].path.should.equal('somewhere/main.tex')
          expect(problems.sizeCheck).to.not.exist
          return done()
        }
      )
    })

    it('should keep populated object', function(done) {
      this.ClsiFormatChecker._checkForConflictingPaths = sinon
        .stub()
        .callsArgWith(1, null, [])
      this.ClsiFormatChecker._checkDocsAreUnderSizeLimit = sinon
        .stub()
        .callsArgWith(1, null, {
          resources: [{ 'a.tex': 'a.tex' }, { 'b.tex': 'b.tex' }],
          totalSize: 1000000
        })
      return this.ClsiFormatChecker.checkRecoursesForProblems(
        this.resources,
        (err, problems) => {
          problems.sizeCheck.resources.length.should.equal(2)
          problems.sizeCheck.totalSize.should.equal(1000000)
          expect(problems.conflictedPaths).to.not.exist
          return done()
        }
      )
    })

    describe('_checkForConflictingPaths', function() {
      beforeEach(function() {
        this.resources.push({
          path: 'chapters/chapter1.tex',
          content: 'other stuff'
        })

        return this.resources.push({
          path: 'chapters.tex',
          content: 'other stuff'
        })
      })

      it('should flag up when a nested file has folder with same subpath as file elsewhere', function(done) {
        this.resources.push({
          path: 'stuff/image',
          url: 'http://somwhere.com'
        })

        return this.ClsiFormatChecker._checkForConflictingPaths(
          this.resources,
          (err, conflictPathErrors) => {
            conflictPathErrors.length.should.equal(1)
            conflictPathErrors[0].path.should.equal('stuff/image')
            return done()
          }
        )
      })

      it('should flag up when a root level file has folder with same subpath as file elsewhere', function(done) {
        this.resources.push({
          path: 'stuff',
          content: 'other stuff'
        })

        return this.ClsiFormatChecker._checkForConflictingPaths(
          this.resources,
          (err, conflictPathErrors) => {
            conflictPathErrors.length.should.equal(1)
            conflictPathErrors[0].path.should.equal('stuff')
            return done()
          }
        )
      })

      it('should not flag up when the file is a substring of a path', function(done) {
        this.resources.push({
          path: 'stuf',
          content: 'other stuff'
        })

        return this.ClsiFormatChecker._checkForConflictingPaths(
          this.resources,
          (err, conflictPathErrors) => {
            conflictPathErrors.length.should.equal(0)
            return done()
          }
        )
      })
    })

    describe('_checkDocsAreUnderSizeLimit', function() {
      it('should error when there is more than 5mb of data', function(done) {
        this.resources.push({
          path: 'massive.tex',
          content: require('crypto')
            .randomBytes(1000 * 1000 * 5)
            .toString('hex')
        })

        while (this.resources.length < 20) {
          this.resources.push({
            path: 'chapters/chapter1.tex',
            url: 'http://somwhere.com'
          })
        }

        return this.ClsiFormatChecker._checkDocsAreUnderSizeLimit(
          this.resources,
          (err, sizeError) => {
            sizeError.totalSize.should.equal(10000016)
            sizeError.resources.length.should.equal(10)
            sizeError.resources[0].path.should.equal('massive.tex')
            sizeError.resources[0].size.should.equal(1000 * 1000 * 10)
            return done()
          }
        )
      })

      it('should return nothing when project is correct size', function(done) {
        this.resources.push({
          path: 'massive.tex',
          content: require('crypto')
            .randomBytes(1000 * 1000 * 1)
            .toString('hex')
        })

        while (this.resources.length < 20) {
          this.resources.push({
            path: 'chapters/chapter1.tex',
            url: 'http://somwhere.com'
          })
        }

        return this.ClsiFormatChecker._checkDocsAreUnderSizeLimit(
          this.resources,
          (err, sizeError) => {
            expect(sizeError).to.not.exist
            return done()
          }
        )
      })
    })
  })
})
