const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb-legacy')

const MODULE_PATH = '../../../../app/src/Features/Project/ProjectHelper.js'

function _mapToAllowed(images) {
  return images.map(image => {
    return { imageName: image.imageName, allowed: image.allowed }
  })
}

describe('ProjectHelper', function () {
  beforeEach(function () {
    this.project = {
      _id: '123213jlkj9kdlsaj',
    }

    this.user = {
      _id: '588f3ddae8ebc1bac07c9fa4',
      first_name: 'bjkdsjfk',
      features: {},
      labsProgram: true,
      labsExperiments: ['monthly-texlive'],
    }

    this.adminUser = {
      _id: 'admin-user-id',
      isAdmin: true,
      alphaProgram: true,
    }

    this.Settings = {
      adminPrivilegeAvailable: true,
      allowedImageNames: [
        { imageName: 'texlive-full:2018.1', imageDesc: 'TeX Live 2018' },
        { imageName: 'texlive-full:2019.1', imageDesc: 'TeX Live 2019' },
        {
          imageName: 'texlive-full:2020.1',
          imageDesc: 'TeX Live 2020',
          alphaOnly: true,
        },
        {
          imageName: 'texlive-full:2021.1',
          imageDesc: 'TeX Live 2021',
          monthlyExperimental: true,
        },
      ],
    }

    this.ProjectHelper = SandboxedModule.require(MODULE_PATH, {
      requires: {
        'mongodb-legacy': { ObjectId },
        '@overleaf/settings': this.Settings,
      },
    })
  })

  describe('isArchived', function () {
    describe('project.archived being an array', function () {
      it('returns true if user id is found', function () {
        this.project.archived = [
          new ObjectId('588f3ddae8ebc1bac07c9fa4'),
          new ObjectId('5c41deb2b4ca500153340809'),
        ]
        expect(
          this.ProjectHelper.isArchived(this.project, this.user._id)
        ).to.equal(true)
      })

      it('returns false if user id is not found', function () {
        this.project.archived = []
        expect(
          this.ProjectHelper.isArchived(this.project, this.user._id)
        ).to.equal(false)
      })
    })

    describe('project.archived being undefined', function () {
      it('returns false if archived is undefined', function () {
        this.project.archived = undefined
        expect(
          this.ProjectHelper.isArchived(this.project, this.user._id)
        ).to.equal(false)
      })
    })
  })

  describe('isTrashed', function () {
    it('returns true if user id is found', function () {
      this.project.trashed = [
        new ObjectId('588f3ddae8ebc1bac07c9fa4'),
        new ObjectId('5c41deb2b4ca500153340809'),
      ]
      expect(
        this.ProjectHelper.isTrashed(this.project, this.user._id)
      ).to.equal(true)
    })

    it('returns false if user id is not found', function () {
      this.project.trashed = []
      expect(
        this.ProjectHelper.isTrashed(this.project, this.user._id)
      ).to.equal(false)
    })

    describe('project.trashed being undefined', function () {
      it('returns false if trashed is undefined', function () {
        this.project.trashed = undefined
        expect(
          this.ProjectHelper.isTrashed(this.project, this.user._id)
        ).to.equal(false)
      })
    })
  })

  describe('compilerFromV1Engine', function () {
    it('returns the correct engine for latex_dvipdf', function () {
      expect(this.ProjectHelper.compilerFromV1Engine('latex_dvipdf')).to.equal(
        'latex'
      )
    })

    it('returns the correct engine for pdflatex', function () {
      expect(this.ProjectHelper.compilerFromV1Engine('pdflatex')).to.equal(
        'pdflatex'
      )
    })

    it('returns the correct engine for xelatex', function () {
      expect(this.ProjectHelper.compilerFromV1Engine('xelatex')).to.equal(
        'xelatex'
      )
    })

    it('returns the correct engine for lualatex', function () {
      expect(this.ProjectHelper.compilerFromV1Engine('lualatex')).to.equal(
        'lualatex'
      )
    })
  })

  describe('getAllowedImagesForUser', function () {
    it('marks alpha only images as not allowed when the user is anonymous', function () {
      const images = this.ProjectHelper.getAllowedImagesForUser(null)
      const imageNames = _mapToAllowed(images)
      expect(imageNames).to.deep.equal([
        { imageName: 'texlive-full:2018.1', allowed: true },
        { imageName: 'texlive-full:2019.1', allowed: true },
        { imageName: 'texlive-full:2020.1', allowed: false },
        { imageName: 'texlive-full:2021.1', allowed: false },
      ])
    })

    it('marks monthly labs images as not allowed when the user is anonymous', function () {
      const images = this.ProjectHelper.getAllowedImagesForUser(null)
      const imageNames = _mapToAllowed(images)
      expect(imageNames).to.deep.equal([
        { imageName: 'texlive-full:2018.1', allowed: true },
        { imageName: 'texlive-full:2019.1', allowed: true },
        { imageName: 'texlive-full:2020.1', allowed: false },
        { imageName: 'texlive-full:2021.1', allowed: false },
      ])
    })

    it('marks monthly labs images as allowed when the user is enrolled', function () {
      const images = this.ProjectHelper.getAllowedImagesForUser(this.user)
      const imageNames = _mapToAllowed(images)
      expect(imageNames).to.deep.equal([
        { imageName: 'texlive-full:2018.1', allowed: true },
        { imageName: 'texlive-full:2019.1', allowed: true },
        { imageName: 'texlive-full:2020.1', allowed: false },
        { imageName: 'texlive-full:2021.1', allowed: true },
      ])
    })

    it('marks alpha only images as not allowed when when the user is not admin', function () {
      const images = this.ProjectHelper.getAllowedImagesForUser(this.user)
      const imageNames = _mapToAllowed(images)
      expect(imageNames).to.deep.equal([
        { imageName: 'texlive-full:2018.1', allowed: true },
        { imageName: 'texlive-full:2019.1', allowed: true },
        { imageName: 'texlive-full:2020.1', allowed: false },
        { imageName: 'texlive-full:2021.1', allowed: true },
      ])
    })

    it('returns all images when the user is admin', function () {
      const images = this.ProjectHelper.getAllowedImagesForUser(this.adminUser)
      const imageNames = _mapToAllowed(images)
      expect(imageNames).to.deep.equal([
        { imageName: 'texlive-full:2018.1', allowed: true },
        { imageName: 'texlive-full:2019.1', allowed: true },
        { imageName: 'texlive-full:2020.1', allowed: true },
        { imageName: 'texlive-full:2021.1', allowed: false },
      ])
    })
  })
})
