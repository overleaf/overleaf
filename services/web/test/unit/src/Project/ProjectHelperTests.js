/* eslint-disable
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
const modulePath = '../../../../app/src/Features/Project/ProjectHelper.js'
const SandboxedModule = require('sandboxed-module')

describe('ProjectHelper', function() {
  beforeEach(function() {
    return (this.ProjectHelper = SandboxedModule.require(modulePath))
  })

  describe('compilerFromV1Engine', function() {
    it('returns the correct engine for latex_dvipdf', function() {
      return expect(
        this.ProjectHelper.compilerFromV1Engine('latex_dvipdf')
      ).to.equal('latex')
    })

    it('returns the correct engine for pdflatex', function() {
      return expect(
        this.ProjectHelper.compilerFromV1Engine('pdflatex')
      ).to.equal('pdflatex')
    })

    it('returns the correct engine for xelatex', function() {
      return expect(
        this.ProjectHelper.compilerFromV1Engine('xelatex')
      ).to.equal('xelatex')
    })

    it('returns the correct engine for lualatex', function() {
      return expect(
        this.ProjectHelper.compilerFromV1Engine('lualatex')
      ).to.equal('lualatex')
    })
  })
})

// describe "ensureNameIsUnique", ->
// see tests for: ProjectDetailsHandler.ensureProjectNameIsUnique, which calls here.
