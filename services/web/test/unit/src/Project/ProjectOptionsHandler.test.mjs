import { vi, expect } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'

const modulePath =
  '../../../../app/src/Features/Project/ProjectOptionsHandler.mjs'

const { ObjectId } = mongodb

describe('ProjectOptionsHandler', function () {
  const projectId = '4eecaffcbffa66588e000008'

  beforeEach(async function (ctx) {
    ctx.projectModel = class Project {}
    ctx.projectModel.updateOne = sinon.stub().resolves()

    ctx.db = {
      projects: {
        updateOne: sinon.stub().resolves(),
      },
    }

    vi.doMock('../../../../app/src/models/Project', () => ({
      Project: ctx.projectModel,
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: {
        languages: [
          { name: 'English', code: 'en' },
          { name: 'French', code: 'fr' },
        ],
        imageRoot: 'docker-repo/subdir',
        allowedImageNames: [
          { imageName: 'texlive-0000.0', imageDesc: 'test image 0' },
          { imageName: 'texlive-1234.5', imageDesc: 'test image 1' },
        ],
      },
    }))

    vi.doMock('../../../../app/src/infrastructure/mongodb', () => ({
      db: ctx.db,
      ObjectId,
    }))

    ctx.handler = (await import(modulePath)).default
  })

  describe('Setting the compiler', function () {
    it('should perform and update on mongo', async function (ctx) {
      await ctx.handler.promises.setCompiler(projectId, 'xeLaTeX')
      const args = ctx.projectModel.updateOne.args[0]
      args[0]._id.should.equal(projectId)
      args[1].compiler.should.equal('xelatex')
    })

    it('should not perform and update on mongo if it is not a recognised compiler', async function (ctx) {
      const fakeComplier = 'something'
      expect(
        ctx.handler.promises.setCompiler(projectId, 'something')
      ).to.be.rejectedWith(`invalid compiler: ${fakeComplier}`)

      ctx.projectModel.updateOne.called.should.equal(false)
    })

    describe('when called without arg', function () {
      it('should callback with null', async function (ctx) {
        await ctx.handler.promises.setCompiler(projectId, null)
        ctx.projectModel.updateOne.callCount.should.equal(0)
      })
    })

    describe('when mongo update error occurs', function () {
      beforeEach(function (ctx) {
        ctx.projectModel.updateOne = sinon.stub().yields('error')
      })

      it('should be rejected', async function (ctx) {
        expect(ctx.handler.promises.setCompiler(projectId, 'xeLaTeX')).to.be
          .rejected
      })
    })
  })

  describe('Setting the imageName', function () {
    it('should perform and update on mongo', async function (ctx) {
      await ctx.handler.promises.setImageName(projectId, 'texlive-1234.5')
      const args = ctx.projectModel.updateOne.args[0]
      args[0]._id.should.equal(projectId)
      args[1].imageName.should.equal('docker-repo/subdir/texlive-1234.5')
    })

    it('should not perform and update on mongo if it is not a reconised image name', async function (ctx) {
      const fakeImageName = 'something'
      expect(
        ctx.handler.promises.setImageName(projectId, fakeImageName)
      ).to.be.rejectedWith(`invalid imageName: ${fakeImageName}`)

      ctx.projectModel.updateOne.called.should.equal(false)
    })

    describe('when called without arg', function () {
      it('should callback with null', async function (ctx) {
        await ctx.handler.promises.setImageName(projectId, null)
        ctx.projectModel.updateOne.callCount.should.equal(0)
      })
    })

    describe('when mongo update error occurs', function () {
      beforeEach(function (ctx) {
        ctx.projectModel.updateOne = sinon.stub().yields('error')
      })

      it('should be rejected', async function (ctx) {
        expect(ctx.handler.promises.setImageName(projectId, 'texlive-1234.5'))
          .to.be.rejected
      })
    })
  })

  describe('setting the spellCheckLanguage', function () {
    it('should perform and update on mongo', async function (ctx) {
      await ctx.handler.promises.setSpellCheckLanguage(projectId, 'fr')
      const args = ctx.projectModel.updateOne.args[0]
      args[0]._id.should.equal(projectId)
      args[1].spellCheckLanguage.should.equal('fr')
    })

    it('should not perform and update on mongo if it is not a reconised langauge', async function (ctx) {
      const fakeLanguageCode = 'not a lang'
      expect(
        ctx.handler.promises.setSpellCheckLanguage(projectId, fakeLanguageCode)
      ).to.be.rejectedWith(`invalid languageCode: ${fakeLanguageCode}`)
      ctx.projectModel.updateOne.called.should.equal(false)
    })

    it('should perform and update on mongo if the language is blank (means turn it off)', async function (ctx) {
      await ctx.handler.promises.setSpellCheckLanguage(projectId, '')
      ctx.projectModel.updateOne.called.should.equal(true)
    })

    describe('when mongo update error occurs', function () {
      beforeEach(function (ctx) {
        ctx.projectModel.updateOne = sinon.stub().yields('error')
      })

      it('should be rejected', async function (ctx) {
        expect(ctx.handler.promises.setSpellCheckLanguage(projectId)).to.be
          .rejected
      })
    })
  })

  describe('setting the brandVariationId', function () {
    it('should perform and update on mongo', async function (ctx) {
      await ctx.handler.promises.setBrandVariationId(projectId, '123')
      const args = ctx.projectModel.updateOne.args[0]
      args[0]._id.should.equal(projectId)
      args[1].brandVariationId.should.equal('123')
    })

    it('should not perform and update on mongo if there is no brand variation', async function (ctx) {
      await ctx.handler.promises.setBrandVariationId(projectId, null)
      ctx.projectModel.updateOne.called.should.equal(false)
    })

    it('should not perform and update on mongo if brand variation is an empty string', async function (ctx) {
      await ctx.handler.promises.setBrandVariationId(projectId, '')
      ctx.projectModel.updateOne.called.should.equal(false)
    })

    describe('when mongo update error occurs', function () {
      beforeEach(function (ctx) {
        ctx.projectModel.updateOne = sinon.stub().yields('error')
      })

      it('should be rejected', async function (ctx) {
        expect(ctx.handler.promises.setBrandVariationId(projectId, '123')).to.be
          .rejected
      })
    })
  })

  describe('setting the rangesSupportEnabled', function () {
    it('should perform and update on mongo', async function (ctx) {
      await ctx.handler.promises.setHistoryRangesSupport(projectId, true)
      sinon.assert.calledWith(
        ctx.db.projects.updateOne,
        { _id: new ObjectId(projectId) },
        { $set: { 'overleaf.history.rangesSupportEnabled': true } }
      )
    })

    describe('when mongo update error occurs', function () {
      beforeEach(function (ctx) {
        ctx.db.projects.updateOne = sinon.stub().yields('error')
      })

      it('should be rejected', async function (ctx) {
        expect(ctx.handler.promises.setHistoryRangesSupport(projectId, true)).to
          .be.rejected
      })
    })
  })

  describe('unsetting the brandVariationId', function () {
    it('should perform and update on mongo', async function (ctx) {
      await ctx.handler.promises.unsetBrandVariationId(projectId)
      const args = ctx.projectModel.updateOne.args[0]
      args[0]._id.should.equal(projectId)
      expect(args[1]).to.deep.equal({ $unset: { brandVariationId: 1 } })
    })

    describe('when mongo update error occurs', function () {
      beforeEach(function (ctx) {
        ctx.projectModel.updateOne = sinon.stub().yields('error')
      })

      it('should be rejected', async function (ctx) {
        expect(ctx.handler.promises.unsetBrandVariationId(projectId)).to.be
          .rejected
      })
    })
  })
})
