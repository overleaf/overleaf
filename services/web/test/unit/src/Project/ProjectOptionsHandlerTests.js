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

describe('ProjectOptionsHandler', function () {
  const projectId = '4eecaffcbffa66588e000008'

  beforeEach(function () {
    let Project
    this.projectModel = Project = class Project {
      constructor(options) {}
    }
    this.projectModel.updateOne = sinon.stub().yields()

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
      },
    })
  })

  describe('Setting the compiler', function () {
    it('should perform and update on mongo', function (done) {
      this.handler.setCompiler(projectId, 'xeLaTeX', err => {
        const args = this.projectModel.updateOne.args[0]
        args[0]._id.should.equal(projectId)
        args[1].compiler.should.equal('xelatex')
        done()
      })
    })

    it('should not perform and update on mongo if it is not a recognised compiler', function (done) {
      this.handler.setCompiler(projectId, 'something', err => {
        this.projectModel.updateOne.called.should.equal(false)
        done()
      })
    })

    describe('when called without arg', function () {
      it('should callback with null', function (done) {
        this.handler.setCompiler(projectId, null, err => {
          expect(err).to.be.undefined
          this.projectModel.updateOne.callCount.should.equal(0)
          done()
        })
      })
    })

    describe('when mongo update error occurs', function () {
      beforeEach(function () {
        this.projectModel.updateOne = sinon.stub().yields('error')
      })

      it('should callback with error', function (done) {
        this.handler.setCompiler(projectId, 'xeLaTeX', err => {
          err.should.equal('error')
          done()
        })
      })
    })
  })

  describe('Setting the imageName', function () {
    it('should perform and update on mongo', function (done) {
      this.handler.setImageName(projectId, 'texlive-1234.5', err => {
        const args = this.projectModel.updateOne.args[0]
        args[0]._id.should.equal(projectId)
        args[1].imageName.should.equal('docker-repo/subdir/texlive-1234.5')
        done()
      })
    })

    it('should not perform and update on mongo if it is not a reconised compiler', function (done) {
      this.handler.setImageName(projectId, 'something', err => {
        this.projectModel.updateOne.called.should.equal(false)
        done()
      })
    })

    describe('when called without arg', function () {
      it('should callback with null', function (done) {
        this.handler.setImageName(projectId, null, err => {
          expect(err).to.be.undefined
          this.projectModel.updateOne.callCount.should.equal(0)
          done()
        })
      })
    })

    describe('when mongo update error occurs', function () {
      beforeEach(function () {
        this.projectModel.updateOne = sinon.stub().yields('error')
      })

      it('should callback with error', function (done) {
        this.handler.setImageName(projectId, 'texlive-1234.5', err => {
          err.should.equal('error')
          done()
        })
      })
    })
  })

  describe('setting the spellCheckLanguage', function () {
    it('should perform and update on mongo', function (done) {
      this.handler.setSpellCheckLanguage(projectId, 'fr', err => {
        const args = this.projectModel.updateOne.args[0]
        args[0]._id.should.equal(projectId)
        args[1].spellCheckLanguage.should.equal('fr')
        done()
      })
    })

    it('should not perform and update on mongo if it is not a reconised compiler', function (done) {
      this.handler.setSpellCheckLanguage(projectId, 'no a lang', err => {
        this.projectModel.updateOne.called.should.equal(false)
        done()
      })
    })

    it('should perform and update on mongo if the language is blank (means turn it off)', function (done) {
      this.handler.setSpellCheckLanguage(projectId, '', err => {
        this.projectModel.updateOne.called.should.equal(true)
        done()
      })
    })

    describe('when mongo update error occurs', function () {
      beforeEach(function () {
        this.projectModel.updateOne = sinon.stub().yields('error')
      })

      it('should callback with error', function (done) {
        this.handler.setSpellCheckLanguage(projectId, 'fr', err => {
          err.should.equal('error')
          done()
        })
      })
    })
  })

  describe('setting the brandVariationId', function () {
    it('should perform and update on mongo', function (done) {
      this.handler.setBrandVariationId(projectId, '123', err => {
        const args = this.projectModel.updateOne.args[0]
        args[0]._id.should.equal(projectId)
        args[1].brandVariationId.should.equal('123')
        done()
      })
    })

    it('should not perform and update on mongo if there is no brand variation', function (done) {
      this.handler.setBrandVariationId(projectId, null, err => {
        this.projectModel.updateOne.called.should.equal(false)
        done()
      })
    })

    it('should not perform and update on mongo if brand variation is an empty string', function (done) {
      this.handler.setBrandVariationId(projectId, '', err => {
        this.projectModel.updateOne.called.should.equal(false)
        done()
      })
    })

    describe('when mongo update error occurs', function () {
      beforeEach(function () {
        this.projectModel.updateOne = sinon.stub().yields('error')
      })

      it('should callback with error', function (done) {
        this.handler.setBrandVariationId(projectId, '123', err => {
          err.should.equal('error')
          done()
        })
      })
    })
  })

  describe('unsetting the brandVariationId', function () {
    it('should perform and update on mongo', function (done) {
      this.handler.unsetBrandVariationId(projectId, err => {
        const args = this.projectModel.updateOne.args[0]
        args[0]._id.should.equal(projectId)
        expect(args[1]).to.deep.equal({ $unset: { brandVariationId: 1 } })
        done()
      })
    })

    describe('when mongo update error occurs', function () {
      beforeEach(function () {
        this.projectModel.updateOne = sinon.stub().yields('error')
      })

      it('should callback with error', function (done) {
        this.handler.unsetBrandVariationId(projectId, err => {
          err.should.equal('error')
          done()
        })
      })
    })
  })
})
