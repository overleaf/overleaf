/* eslint-disable
    n/handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
    no-useless-constructor,
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
const modulePath =
  '../../../../app/src/Features/Project/ProjectOptionsHandler.js'
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb-legacy')

describe('ProjectOptionsHandler', function () {
  const projectId = '4eecaffcbffa66588e000008'

  beforeEach(function () {
    let Project
    this.projectModel = Project = class Project {
      constructor(options) {}
    }
    this.projectModel.updateOne = sinon.stub().resolves()

    this.db = {
      projects: {
        updateOne: sinon.stub().resolves(),
      },
    }

    this.handler = SandboxedModule.require(modulePath, {
      requires: {
        '../../models/Project': { Project: this.projectModel },
        '@overleaf/settings': {
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
        '../../infrastructure/mongodb': { db: this.db, ObjectId },
      },
    })
  })

  describe('Setting the compiler', function () {
    it('should perform and update on mongo', async function () {
      await this.handler.promises.setCompiler(projectId, 'xeLaTeX')
      const args = this.projectModel.updateOne.args[0]
      args[0]._id.should.equal(projectId)
      args[1].compiler.should.equal('xelatex')
    })

    it('should not perform and update on mongo if it is not a recognised compiler', async function () {
      const fakeComplier = 'something'
      expect(
        this.handler.promises.setCompiler(projectId, 'something')
      ).to.be.rejectedWith(`invalid compiler: ${fakeComplier}`)

      this.projectModel.updateOne.called.should.equal(false)
    })

    describe('when called without arg', function () {
      it('should callback with null', async function () {
        await this.handler.promises.setCompiler(projectId, null)
        this.projectModel.updateOne.callCount.should.equal(0)
      })
    })

    describe('when mongo update error occurs', function () {
      beforeEach(function () {
        this.projectModel.updateOne = sinon.stub().yields('error')
      })

      it('should be rejected', async function () {
        expect(this.handler.promises.setCompiler(projectId, 'xeLaTeX')).to.be
          .rejected
      })
    })
  })

  describe('Setting the imageName', function () {
    it('should perform and update on mongo', async function () {
      await this.handler.promises.setImageName(projectId, 'texlive-1234.5')
      const args = this.projectModel.updateOne.args[0]
      args[0]._id.should.equal(projectId)
      args[1].imageName.should.equal('docker-repo/subdir/texlive-1234.5')
    })

    it('should not perform and update on mongo if it is not a reconised image name', async function () {
      const fakeImageName = 'something'
      expect(
        this.handler.promises.setImageName(projectId, fakeImageName)
      ).to.be.rejectedWith(`invalid imageName: ${fakeImageName}`)

      this.projectModel.updateOne.called.should.equal(false)
    })

    describe('when called without arg', function () {
      it('should callback with null', async function () {
        await this.handler.promises.setImageName(projectId, null)
        this.projectModel.updateOne.callCount.should.equal(0)
      })
    })

    describe('when mongo update error occurs', function () {
      beforeEach(function () {
        this.projectModel.updateOne = sinon.stub().yields('error')
      })

      it('should be rejected', async function () {
        expect(this.handler.promises.setImageName(projectId, 'texlive-1234.5'))
          .to.be.rejected
      })
    })
  })

  describe('setting the spellCheckLanguage', function () {
    it('should perform and update on mongo', async function () {
      await this.handler.promises.setSpellCheckLanguage(projectId, 'fr')
      const args = this.projectModel.updateOne.args[0]
      args[0]._id.should.equal(projectId)
      args[1].spellCheckLanguage.should.equal('fr')
    })

    it('should not perform and update on mongo if it is not a reconised langauge', async function () {
      const fakeLanguageCode = 'not a lang'
      expect(
        this.handler.promises.setSpellCheckLanguage(projectId, fakeLanguageCode)
      ).to.be.rejectedWith(`invalid languageCode: ${fakeLanguageCode}`)
      this.projectModel.updateOne.called.should.equal(false)
    })

    it('should perform and update on mongo if the language is blank (means turn it off)', async function () {
      await this.handler.promises.setSpellCheckLanguage(projectId, '')
      this.projectModel.updateOne.called.should.equal(true)
    })

    describe('when mongo update error occurs', function () {
      beforeEach(function () {
        this.projectModel.updateOne = sinon.stub().yields('error')
      })

      it('should be rejected', async function () {
        expect(this.handler.promises.setSpellCheckLanguage(projectId)).to.be
          .rejected
      })
    })
  })

  describe('setting the brandVariationId', function () {
    it('should perform and update on mongo', async function () {
      await this.handler.promises.setBrandVariationId(projectId, '123')
      const args = this.projectModel.updateOne.args[0]
      args[0]._id.should.equal(projectId)
      args[1].brandVariationId.should.equal('123')
    })

    it('should not perform and update on mongo if there is no brand variation', async function () {
      await this.handler.promises.setBrandVariationId(projectId, null)
      this.projectModel.updateOne.called.should.equal(false)
    })

    it('should not perform and update on mongo if brand variation is an empty string', async function () {
      await this.handler.promises.setBrandVariationId(projectId, '')
      this.projectModel.updateOne.called.should.equal(false)
    })

    describe('when mongo update error occurs', function () {
      beforeEach(function () {
        this.projectModel.updateOne = sinon.stub().yields('error')
      })

      it('should be rejected', async function () {
        expect(this.handler.promises.setBrandVariationId(projectId, '123')).to
          .be.rejected
      })
    })
  })

  describe('setting the rangesSupportEnabled', function () {
    it('should perform and update on mongo', async function () {
      await this.handler.promises.setHistoryRangesSupport(projectId, true)
      sinon.assert.calledWith(
        this.db.projects.updateOne,
        { _id: new ObjectId(projectId) },
        { $set: { 'overleaf.history.rangesSupportEnabled': true } }
      )
    })

    describe('when mongo update error occurs', function () {
      beforeEach(function () {
        this.db.projects.updateOne = sinon.stub().yields('error')
      })

      it('should be rejected', async function () {
        expect(this.handler.promises.setHistoryRangesSupport(projectId, true))
          .to.be.rejected
      })
    })
  })

  describe('unsetting the brandVariationId', function () {
    it('should perform and update on mongo', async function () {
      await this.handler.promises.unsetBrandVariationId(projectId)
      const args = this.projectModel.updateOne.args[0]
      args[0]._id.should.equal(projectId)
      expect(args[1]).to.deep.equal({ $unset: { brandVariationId: 1 } })
    })

    describe('when mongo update error occurs', function () {
      beforeEach(function () {
        this.projectModel.updateOne = sinon.stub().yields('error')
      })

      it('should be rejected', async function () {
        expect(this.handler.promises.unsetBrandVariationId(projectId)).to.be
          .rejected
      })
    })
  })
})
