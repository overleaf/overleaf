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
const { ObjectId } = require('mongojs')

describe('ProjectHelper', function() {
  beforeEach(function() {
    this.project = {
      _id: '123213jlkj9kdlsaj'
    }

    this.user = {
      _id: '588f3ddae8ebc1bac07c9fa4',
      first_name: 'bjkdsjfk',
      features: {}
    }

    return (this.ProjectHelper = SandboxedModule.require(modulePath))
  })

  describe('isArchived', function() {
    describe('project.archived being an array', function() {
      it('returns true if user id is found', function() {
        this.project.archived = [
          ObjectId('588f3ddae8ebc1bac07c9fa4'),
          ObjectId('5c41deb2b4ca500153340809')
        ]
        expect(
          this.ProjectHelper.isArchived(this.project, this.user._id)
        ).to.equal(true)
      })

      it('returns false if user id is not found', function() {
        this.project.archived = []
        expect(
          this.ProjectHelper.isArchived(this.project, this.user._id)
        ).to.equal(false)
      })
    })

    describe('project.archived being a boolean', function() {
      it('returns true if archived is true', function() {
        this.project.archived = true
        expect(
          this.ProjectHelper.isArchived(this.project, this.user._id)
        ).to.equal(true)
      })

      it('returns false if archived is false', function() {
        this.project.archived = false
        expect(
          this.ProjectHelper.isArchived(this.project, this.user._id)
        ).to.equal(false)
      })
    })

    describe('project.archived being undefined', function() {
      it('returns false if archived is undefined', function() {
        this.project.archived = undefined
        expect(
          this.ProjectHelper.isArchived(this.project, this.user._id)
        ).to.equal(false)
      })
    })
  })

  describe('isTrashed', function() {
    it('returns true if user id is found', function() {
      this.project.trashed = [
        ObjectId('588f3ddae8ebc1bac07c9fa4'),
        ObjectId('5c41deb2b4ca500153340809')
      ]
      expect(
        this.ProjectHelper.isTrashed(this.project, this.user._id)
      ).to.equal(true)
    })

    it('returns false if user id is not found', function() {
      this.project.trashed = []
      expect(
        this.ProjectHelper.isTrashed(this.project, this.user._id)
      ).to.equal(false)
    })

    describe('project.trashed being undefined', function() {
      it('returns false if trashed is undefined', function() {
        this.project.trashed = undefined
        expect(
          this.ProjectHelper.isTrashed(this.project, this.user._id)
        ).to.equal(false)
      })
    })
  })

  describe('calculateArchivedArray', function() {
    describe('project.archived being an array', function() {
      it('returns an array adding the current user id when archiving', function() {
        const project = { archived: [] }
        const result = this.ProjectHelper.calculateArchivedArray(
          project,
          ObjectId('5c922599cdb09e014aa7d499'),
          'ARCHIVE'
        )
        expect(result).to.deep.equal([ObjectId('5c922599cdb09e014aa7d499')])
      })

      it('returns an array without the current user id when unarchiving', function() {
        const project = { archived: [ObjectId('5c922599cdb09e014aa7d499')] }
        const result = this.ProjectHelper.calculateArchivedArray(
          project,
          ObjectId('5c922599cdb09e014aa7d499'),
          'UNARCHIVE'
        )
        expect(result).to.deep.equal([])
      })
    })

    describe('project.archived being a boolean and being true', function() {
      it('returns an array of all associated user ids when archiving', function() {
        const project = {
          archived: true,
          owner_ref: this.user._id,
          collaberator_refs: [
            ObjectId('4f2cfb341eb5855a5b000f8b'),
            ObjectId('5c45f3bd425ead01488675aa')
          ],
          readOnly_refs: [ObjectId('5c92243fcdb09e014aa7d487')],
          tokenAccessReadAndWrite_refs: [ObjectId('5c922599cdb09e014aa7d499')],
          tokenAccessReadOnly_refs: []
        }

        const result = this.ProjectHelper.calculateArchivedArray(
          project,
          this.user._id,
          'ARCHIVE'
        )
        expect(result).to.deep.equal([
          this.user._id,
          ObjectId('4f2cfb341eb5855a5b000f8b'),
          ObjectId('5c45f3bd425ead01488675aa'),
          ObjectId('5c92243fcdb09e014aa7d487'),
          ObjectId('5c922599cdb09e014aa7d499')
        ])
      })

      it('returns an array of all associated users without the current user id when unarchived', function() {
        const project = {
          archived: true,
          owner_ref: this.user._id,
          collaberator_refs: [
            ObjectId('4f2cfb341eb5855a5b000f8b'),
            ObjectId('5c45f3bd425ead01488675aa'),
            ObjectId('5c922599cdb09e014aa7d499')
          ],
          readOnly_refs: [ObjectId('5c92243fcdb09e014aa7d487')],
          tokenAccessReadAndWrite_refs: [ObjectId('5c922599cdb09e014aa7d499')],
          tokenAccessReadOnly_refs: []
        }

        const result = this.ProjectHelper.calculateArchivedArray(
          project,
          this.user._id,
          'UNARCHIVE'
        )
        expect(result).to.deep.equal([
          ObjectId('4f2cfb341eb5855a5b000f8b'),
          ObjectId('5c45f3bd425ead01488675aa'),
          ObjectId('5c922599cdb09e014aa7d499'),
          ObjectId('5c92243fcdb09e014aa7d487')
        ])
      })
    })

    describe('project.archived being a boolean and being false', function() {
      it('returns an array adding the current user id when archiving', function() {
        const project = { archived: false }
        const result = this.ProjectHelper.calculateArchivedArray(
          project,
          ObjectId('5c922599cdb09e014aa7d499'),
          'ARCHIVE'
        )
        expect(result).to.deep.equal([ObjectId('5c922599cdb09e014aa7d499')])
      })

      it('returns an empty array when unarchiving', function() {
        const project = { archived: false }
        const result = this.ProjectHelper.calculateArchivedArray(
          project,
          ObjectId('5c922599cdb09e014aa7d499'),
          'UNARCHIVE'
        )
        expect(result).to.deep.equal([])
      })
    })

    describe('project.archived not being set', function() {
      it('returns an array adding the current user id when archiving', function() {
        const project = { archived: undefined }
        const result = this.ProjectHelper.calculateArchivedArray(
          project,
          ObjectId('5c922599cdb09e014aa7d499'),
          'ARCHIVE'
        )
        expect(result).to.deep.equal([ObjectId('5c922599cdb09e014aa7d499')])
      })

      it('returns an empty array when unarchiving', function() {
        const project = { archived: undefined }
        const result = this.ProjectHelper.calculateArchivedArray(
          project,
          ObjectId('5c922599cdb09e014aa7d499'),
          'UNARCHIVE'
        )
        expect(result).to.deep.equal([])
      })
    })
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
// see tests for: ProjectDetailsHandler.generateUniqueName, which calls here.
