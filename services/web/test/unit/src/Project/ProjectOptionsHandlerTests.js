/* eslint-disable
    camelcase,
    handle-callback-err,
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
const chai = require('chai')
const { expect } = chai
const should = chai.should()
const modulePath =
  '../../../../app/src/Features/Project/ProjectOptionsHandler.js'
const SandboxedModule = require('sandboxed-module')

describe('ProjectOptionsHandler', function() {
  const project_id = '4eecaffcbffa66588e000008'

  beforeEach(function() {
    let Project
    this.projectModel = Project = class Project {
      constructor(options) {}
    }
    this.projectModel.update = sinon.stub().yields()

    this.handler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../../models/Project': { Project: this.projectModel },
        'settings-sharelatex': {
          languages: [
            { name: 'English', code: 'en' },
            { name: 'French', code: 'fr' }
          ],
          imageRoot: 'docker-repo/subdir',
          allowedImageNames: [
            { imageName: 'texlive-0000.0', imageDesc: 'test image 0' },
            { imageName: 'texlive-1234.5', imageDesc: 'test image 1' }
          ]
        },
        'logger-sharelatex': {
          log() {},
          err() {}
        }
      }
    })
  })

  describe('Setting the compiler', function() {
    it('should perform and update on mongo', function(done) {
      this.handler.setCompiler(project_id, 'xeLaTeX', err => {
        const args = this.projectModel.update.args[0]
        args[0]._id.should.equal(project_id)
        args[1].compiler.should.equal('xelatex')
        done()
      })
    })

    it('should not perform and update on mongo if it is not a recognised compiler', function(done) {
      this.handler.setCompiler(project_id, 'something', err => {
        this.projectModel.update.called.should.equal(false)
        done()
      })
    })

    describe('when called without arg', function() {
      it('should callback with null', function(done) {
        this.handler.setCompiler(project_id, null, err => {
          expect(err).to.be.undefined
          this.projectModel.update.callCount.should.equal(0)
          done()
        })
      })
    })

    describe('when mongo update error occurs', function() {
      beforeEach(function() {
        this.projectModel.update = sinon.stub().yields('error')
      })

      it('should callback with error', function(done) {
        this.handler.setCompiler(project_id, 'xeLaTeX', err => {
          err.should.equal('error')
          done()
        })
      })
    })
  })

  describe('Setting the imageName', function() {
    it('should perform and update on mongo', function(done) {
      this.handler.setImageName(project_id, 'texlive-1234.5', err => {
        const args = this.projectModel.update.args[0]
        args[0]._id.should.equal(project_id)
        args[1].imageName.should.equal('docker-repo/subdir/texlive-1234.5')
        done()
      })
    })

    it('should not perform and update on mongo if it is not a reconised compiler', function(done) {
      this.handler.setImageName(project_id, 'something', err => {
        this.projectModel.update.called.should.equal(false)
        done()
      })
    })

    describe('when called without arg', function() {
      it('should callback with null', function(done) {
        this.handler.setImageName(project_id, null, err => {
          expect(err).to.be.undefined
          this.projectModel.update.callCount.should.equal(0)
          done()
        })
      })
    })

    describe('when mongo update error occurs', function() {
      beforeEach(function() {
        this.projectModel.update = sinon.stub().yields('error')
      })

      it('should callback with error', function(done) {
        this.handler.setImageName(project_id, 'texlive-1234.5', err => {
          err.should.equal('error')
          done()
        })
      })
    })
  })

  describe('setting the spellCheckLanguage', function() {
    it('should perform and update on mongo', function(done) {
      this.handler.setSpellCheckLanguage(project_id, 'fr', err => {
        const args = this.projectModel.update.args[0]
        args[0]._id.should.equal(project_id)
        args[1].spellCheckLanguage.should.equal('fr')
        done()
      })
    })

    it('should not perform and update on mongo if it is not a reconised compiler', function(done) {
      this.handler.setSpellCheckLanguage(project_id, 'no a lang', err => {
        this.projectModel.update.called.should.equal(false)
        done()
      })
    })

    it('should perform and update on mongo if the language is blank (means turn it off)', function(done) {
      this.handler.setSpellCheckLanguage(project_id, '', err => {
        this.projectModel.update.called.should.equal(true)
        done()
      })
    })

    describe('when mongo update error occurs', function() {
      beforeEach(function() {
        this.projectModel.update = sinon.stub().yields('error')
      })

      it('should callback with error', function(done) {
        this.handler.setSpellCheckLanguage(project_id, 'fr', err => {
          err.should.equal('error')
          done()
        })
      })
    })
  })

  describe('setting the brandVariationId', function() {
    it('should perform and update on mongo', function(done) {
      this.handler.setBrandVariationId(project_id, '123', err => {
        const args = this.projectModel.update.args[0]
        args[0]._id.should.equal(project_id)
        args[1].brandVariationId.should.equal('123')
        done()
      })
    })

    it('should not perform and update on mongo if there is no brand variation', function(done) {
      this.handler.setBrandVariationId(project_id, null, err => {
        this.projectModel.update.called.should.equal(false)
        done()
      })
    })

    it('should not perform and update on mongo if brand variation is an empty string', function(done) {
      this.handler.setBrandVariationId(project_id, '', err => {
        this.projectModel.update.called.should.equal(false)
        done()
      })
    })

    describe('when mongo update error occurs', function() {
      beforeEach(function() {
        this.projectModel.update = sinon.stub().yields('error')
      })

      it('should callback with error', function(done) {
        this.handler.setBrandVariationId(project_id, '123', err => {
          err.should.equal('error')
          done()
        })
      })
    })
  })

  describe('unsetting the brandVariationId', function() {
    it('should perform and update on mongo', function(done) {
      this.handler.unsetBrandVariationId(project_id, err => {
        const args = this.projectModel.update.args[0]
        args[0]._id.should.equal(project_id)
        expect(args[1]).to.deep.equal({ $unset: { brandVariationId: 1 } })
        done()
      })
    })

    describe('when mongo update error occurs', function() {
      beforeEach(function() {
        this.projectModel.update = sinon.stub().yields('error')
      })

      it('should callback with error', function(done) {
        this.handler.unsetBrandVariationId(project_id, err => {
          err.should.equal('error')
          done()
        })
      })
    })
  })
})
