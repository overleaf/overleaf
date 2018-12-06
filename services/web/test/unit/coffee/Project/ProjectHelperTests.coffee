sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Project/ProjectHelper.js"
SandboxedModule = require('sandboxed-module')

describe "ProjectHelper", ->
	beforeEach ->
		@ProjectHelper = SandboxedModule.require modulePath

	describe "compilerFromV1Engine", ->
		it "returns the correct engine for latex_dvipdf", ->
			expect(@ProjectHelper.compilerFromV1Engine('latex_dvipdf')).to.equal 'latex'

		it "returns the correct engine for pdflatex", ->
			expect(@ProjectHelper.compilerFromV1Engine('pdflatex')).to.equal 'pdflatex'

		it "returns the correct engine for xelatex", ->
			expect(@ProjectHelper.compilerFromV1Engine('xelatex')).to.equal 'xelatex'

		it "returns the correct engine for lualatex", ->
			expect(@ProjectHelper.compilerFromV1Engine('lualatex')).to.equal 'lualatex'

	# describe "ensureNameIsUnique", ->
		# see tests for: ProjectDetailsHandler.ensureProjectNameIsUnique, which calls here.