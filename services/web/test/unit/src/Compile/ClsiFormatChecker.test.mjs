import { vi, expect } from 'vitest'
import sinon from 'sinon'

const modulePath = '../../../../app/src/Features/Compile/ClsiFormatChecker.mjs'

describe('ClsiFormatChecker', function () {
  beforeEach(async function (ctx) {
    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {
        compileBodySizeLimitMb: 5,
      }),
    }))

    ctx.ClsiFormatChecker = (await import(modulePath)).default
    ctx.project_id = 'project-id'
  })

  describe('checkRecoursesForProblems', function () {
    beforeEach(function (ctx) {
      ctx.resources = [
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
          url: `http:somewhere.com/project/${ctx.project_id}/file/1234124321312`,
          modified: 'more stuff',
        },
      ]
    })

    it('should call _checkDocsAreUnderSizeLimit and _checkForConflictingPaths', async function (ctx) {
      ctx.ClsiFormatChecker._checkForConflictingPaths = sinon
        .stub()
        .returns(null)
      ctx.ClsiFormatChecker._checkDocsAreUnderSizeLimit = sinon
        .stub()
        .returns(null)
      await ctx.ClsiFormatChecker.checkRecoursesForProblems(ctx.resources)
      ctx.ClsiFormatChecker._checkForConflictingPaths.called.should.equal(true)
      ctx.ClsiFormatChecker._checkDocsAreUnderSizeLimit.called.should.equal(
        true
      )
    })

    it('should remove undefined errors', async function (ctx) {
      ctx.ClsiFormatChecker._checkForConflictingPaths = sinon.stub().returns([])
      ctx.ClsiFormatChecker._checkDocsAreUnderSizeLimit = sinon
        .stub()
        .returns({})
      const problems = await ctx.ClsiFormatChecker.checkRecoursesForProblems(
        ctx.resources
      )
      expect(problems).to.not.exist
    })

    it('should keep populated arrays', async function (ctx) {
      ctx.ClsiFormatChecker._checkForConflictingPaths = sinon
        .stub()
        .returns([{ path: 'somewhere/main.tex' }])
      ctx.ClsiFormatChecker._checkDocsAreUnderSizeLimit = sinon
        .stub()
        .returns({})
      const problems = await ctx.ClsiFormatChecker.checkRecoursesForProblems(
        ctx.resources
      )
      problems.conflictedPaths[0].path.should.equal('somewhere/main.tex')
      expect(problems.sizeCheck).to.not.exist
    })

    it('should keep populated object', async function (ctx) {
      ctx.ClsiFormatChecker._checkForConflictingPaths = sinon.stub().returns([])
      ctx.ClsiFormatChecker._checkDocsAreUnderSizeLimit = sinon.stub().returns({
        resources: [{ 'a.tex': 'a.tex' }, { 'b.tex': 'b.tex' }],
        totalSize: 1000000,
      })
      const problems = await ctx.ClsiFormatChecker.checkRecoursesForProblems(
        ctx.resources
      )
      problems.sizeCheck.resources.length.should.equal(2)
      problems.sizeCheck.totalSize.should.equal(1000000)
      expect(problems.conflictedPaths).to.not.exist
    })

    describe('_checkForConflictingPaths', function () {
      beforeEach(function (ctx) {
        ctx.resources.push({
          path: 'chapters/chapter1.tex',
          content: 'other stuff',
        })

        ctx.resources.push({
          path: 'chapters.tex',
          content: 'other stuff',
        })
      })

      it('should flag up when a nested file has folder with same subpath as file elsewhere', async function (ctx) {
        ctx.resources.push({
          path: 'stuff/image',
          url: 'http://somwhere.com',
        })

        const conflictPathErrors =
          await ctx.ClsiFormatChecker._checkForConflictingPaths(ctx.resources)
        conflictPathErrors.length.should.equal(1)
        conflictPathErrors[0].path.should.equal('stuff/image')
      })

      it('should flag up when a root level file has folder with same subpath as file elsewhere', async function (ctx) {
        ctx.resources.push({
          path: 'stuff',
          content: 'other stuff',
        })

        const conflictPathErrors =
          await ctx.ClsiFormatChecker._checkForConflictingPaths(ctx.resources)
        conflictPathErrors.length.should.equal(1)
        conflictPathErrors[0].path.should.equal('stuff')
      })

      it('should not flag up when the file is a substring of a path', async function (ctx) {
        ctx.resources.push({
          path: 'stuf',
          content: 'other stuff',
        })

        const conflictPathErrors =
          await ctx.ClsiFormatChecker._checkForConflictingPaths(ctx.resources)
        conflictPathErrors.length.should.equal(0)
      })
    })

    describe('_checkDocsAreUnderSizeLimit', function () {
      it('should error when there is more than 5mb of data', async function (ctx) {
        ctx.resources.push({
          path: 'massive.tex',
          content: 'hello world'.repeat(833333), // over 5mb limit
        })

        while (ctx.resources.length < 20) {
          ctx.resources.push({
            path: 'chapters/chapter1.tex',
            url: 'http://somwhere.com',
          })
        }

        const sizeError =
          await ctx.ClsiFormatChecker._checkDocsAreUnderSizeLimit(ctx.resources)
        sizeError.totalSize.should.equal(16 + 833333 * 11) // 16 is for earlier resources
        sizeError.resources.length.should.equal(10)
        sizeError.resources[0].path.should.equal('massive.tex')
        sizeError.resources[0].size.should.equal(833333 * 11)
      })

      it('should return nothing when project is correct size', async function (ctx) {
        ctx.resources.push({
          path: 'massive.tex',
          content: 'x'.repeat(2 * 1000 * 1000),
        })

        while (ctx.resources.length < 20) {
          ctx.resources.push({
            path: 'chapters/chapter1.tex',
            url: 'http://somwhere.com',
          })
        }

        const sizeError =
          await ctx.ClsiFormatChecker._checkDocsAreUnderSizeLimit(ctx.resources)
        expect(sizeError).to.not.exist
      })
    })
  })
})
