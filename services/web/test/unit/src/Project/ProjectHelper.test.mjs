import { vi, expect } from 'vitest'
import mongodb from 'mongodb-legacy'

const { ObjectId } = mongodb

const MODULE_PATH = '../../../../app/src/Features/Project/ProjectHelper.mjs'

function _mapToAllowed(images) {
  return images.map(image => {
    return { imageName: image.imageName, allowed: image.allowed }
  })
}

describe('ProjectHelper', function () {
  beforeEach(async function (ctx) {
    ctx.project = {
      _id: '123213jlkj9kdlsaj',
    }

    ctx.user = {
      _id: '588f3ddae8ebc1bac07c9fa4',
      first_name: 'bjkdsjfk',
      features: {},
      labsProgram: true,
      labsExperiments: ['monthly-texlive'],
    }

    ctx.adminUser = {
      _id: 'admin-user-id',
      isAdmin: true,
      alphaProgram: true,
    }

    ctx.Settings = {
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

    ctx.SplitTestHandler = {
      promises: {
        getAssignmentForUser: vi.fn().mockResolvedValue({ variant: 'default' }),
      },
    }

    vi.doMock('mongodb-legacy', () => ({
      default: { ObjectId },
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.Settings,
    }))

    vi.doMock(
      '../../../../app/src/Features/SplitTests/SplitTestHandler.mjs',
      () => ({
        default: ctx.SplitTestHandler,
      })
    )

    ctx.ProjectHelper = (await import(MODULE_PATH)).default
  })

  describe('isArchived', function () {
    describe('project.archived being an array', function () {
      it('returns true if user id is found', function (ctx) {
        ctx.project.archived = [
          new ObjectId('588f3ddae8ebc1bac07c9fa4'),
          new ObjectId('5c41deb2b4ca500153340809'),
        ]
        expect(
          ctx.ProjectHelper.isArchived(ctx.project, ctx.user._id)
        ).to.equal(true)
      })

      it('returns false if user id is not found', function (ctx) {
        ctx.project.archived = []
        expect(
          ctx.ProjectHelper.isArchived(ctx.project, ctx.user._id)
        ).to.equal(false)
      })
    })

    describe('project.archived being undefined', function () {
      it('returns false if archived is undefined', function (ctx) {
        ctx.project.archived = undefined
        expect(
          ctx.ProjectHelper.isArchived(ctx.project, ctx.user._id)
        ).to.equal(false)
      })
    })
  })

  describe('isTrashed', function () {
    it('returns true if user id is found', function (ctx) {
      ctx.project.trashed = [
        new ObjectId('588f3ddae8ebc1bac07c9fa4'),
        new ObjectId('5c41deb2b4ca500153340809'),
      ]
      expect(ctx.ProjectHelper.isTrashed(ctx.project, ctx.user._id)).to.equal(
        true
      )
    })

    it('returns false if user id is not found', function (ctx) {
      ctx.project.trashed = []
      expect(ctx.ProjectHelper.isTrashed(ctx.project, ctx.user._id)).to.equal(
        false
      )
    })

    describe('project.trashed being undefined', function () {
      it('returns false if trashed is undefined', function (ctx) {
        ctx.project.trashed = undefined
        expect(ctx.ProjectHelper.isTrashed(ctx.project, ctx.user._id)).to.equal(
          false
        )
      })
    })
  })

  describe('compilerFromV1Engine', function () {
    it('returns the correct engine for latex_dvipdf', function (ctx) {
      expect(ctx.ProjectHelper.compilerFromV1Engine('latex_dvipdf')).to.equal(
        'latex'
      )
    })

    it('returns the correct engine for pdflatex', function (ctx) {
      expect(ctx.ProjectHelper.compilerFromV1Engine('pdflatex')).to.equal(
        'pdflatex'
      )
    })

    it('returns the correct engine for xelatex', function (ctx) {
      expect(ctx.ProjectHelper.compilerFromV1Engine('xelatex')).to.equal(
        'xelatex'
      )
    })

    it('returns the correct engine for lualatex', function (ctx) {
      expect(ctx.ProjectHelper.compilerFromV1Engine('lualatex')).to.equal(
        'lualatex'
      )
    })
  })

  describe('getAllowedImagesForUser', function () {
    it('marks alpha only images as not allowed when the user is anonymous', async function (ctx) {
      const images = await ctx.ProjectHelper.getAllowedImagesForUser(null)
      const imageNames = _mapToAllowed(images)
      expect(imageNames).to.deep.equal([
        { imageName: 'texlive-full:2018.1', allowed: true },
        { imageName: 'texlive-full:2019.1', allowed: true },
        { imageName: 'texlive-full:2020.1', allowed: false },
        { imageName: 'texlive-full:2021.1', allowed: false },
      ])
    })

    it('marks monthly labs images as not allowed when the user is anonymous', async function (ctx) {
      const images = await ctx.ProjectHelper.getAllowedImagesForUser(null)
      const imageNames = _mapToAllowed(images)
      expect(imageNames).to.deep.equal([
        { imageName: 'texlive-full:2018.1', allowed: true },
        { imageName: 'texlive-full:2019.1', allowed: true },
        { imageName: 'texlive-full:2020.1', allowed: false },
        { imageName: 'texlive-full:2021.1', allowed: false },
      ])
    })

    it('marks monthly labs images as allowed when the user is enrolled', async function (ctx) {
      ctx.SplitTestHandler.promises.getAssignmentForUser.mockResolvedValue({
        variant: 'enabled',
      })
      const images = await ctx.ProjectHelper.getAllowedImagesForUser(ctx.user)
      const imageNames = _mapToAllowed(images)
      expect(imageNames).to.deep.equal([
        { imageName: 'texlive-full:2018.1', allowed: true },
        { imageName: 'texlive-full:2019.1', allowed: true },
        { imageName: 'texlive-full:2020.1', allowed: false },
        { imageName: 'texlive-full:2021.1', allowed: true },
      ])
    })

    it('marks alpha only images as not allowed when when the user is not admin', async function (ctx) {
      const images = await ctx.ProjectHelper.getAllowedImagesForUser(ctx.user)
      const imageNames = _mapToAllowed(images)
      expect(imageNames).to.deep.equal([
        { imageName: 'texlive-full:2018.1', allowed: true },
        { imageName: 'texlive-full:2019.1', allowed: true },
        { imageName: 'texlive-full:2020.1', allowed: false },
        { imageName: 'texlive-full:2021.1', allowed: false },
      ])
    })

    it('returns all images when the user is admin', async function (ctx) {
      const images = await ctx.ProjectHelper.getAllowedImagesForUser(
        ctx.adminUser
      )
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
