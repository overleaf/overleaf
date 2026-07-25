import { vi, expect } from 'vitest'
import { load } from 'cheerio'
import path from 'node:path'

const LAYOUT_PATH = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Email/Layouts/BaseEmailLayout'
)

async function buildLayoutWithEnv(env) {
  vi.resetModules()
  vi.doMock('@overleaf/settings', () => ({
    default: {
      appName: 'TestApp',
      siteUrl: 'https://www.example.com',
      env,
    },
  }))
  const { default: layout } = await import(LAYOUT_PATH)
  return layout({ body: 'Test body', footerMessage: '' })
}

describe('BaseEmailLayout branding', function () {
  afterEach(function () {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  describe('on SaaS', function () {
    it('should show the logo image', async function () {
      const html = await buildLayoutWithEnv('saas')
      const dom = load(html)
      const logoImg = dom('img[alt="TestApp"]')
      expect(logoImg.length).to.equal(1)
      expect(logoImg.attr('src')).to.contain('email-logo@2x.png')
    })

    it('should show the tagline image', async function () {
      const html = await buildLayoutWithEnv('saas')
      expect(html).to.contain('email-footer-tagline@2x.png')
    })
  })

  describe('on server-ce', function () {
    it('should show the app name as text instead of logo', async function () {
      const html = await buildLayoutWithEnv('server-ce')
      const dom = load(html)
      const logoImg = dom('img[alt="TestApp"]')
      expect(logoImg.length).to.equal(0)
      expect(html).to.contain('TestApp')
      expect(html).to.not.contain('email-logo@2x.png')
    })

    it('should not show the tagline image', async function () {
      const html = await buildLayoutWithEnv('server-ce')
      expect(html).to.not.contain('email-footer-tagline@2x.png')
    })
  })

  describe('on server-pro', function () {
    it('should show the app name as text instead of logo', async function () {
      const html = await buildLayoutWithEnv('server-pro')
      const dom = load(html)
      const logoImg = dom('img[alt="TestApp"]')
      expect(logoImg.length).to.equal(0)
      expect(html).to.contain('TestApp')
      expect(html).to.not.contain('email-logo@2x.png')
    })

    it('should not show the tagline image', async function () {
      const html = await buildLayoutWithEnv('server-pro')
      expect(html).to.not.contain('email-footer-tagline@2x.png')
    })
  })
})
