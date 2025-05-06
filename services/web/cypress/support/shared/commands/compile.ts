import { v4 as uuid } from 'uuid'

const outputFiles = () => {
  const build = uuid()

  return [
    {
      path: 'output.pdf',
      build,
      url: `/build/${build}/output.pdf`,
      type: 'pdf',
    },
    {
      path: 'output.bbl',
      build,
      url: `/build/${build}/output.bbl`,
      type: 'bbl',
    },
    {
      path: 'output.bib',
      build,
      url: `/build/${build}/output.bib`,
      type: 'bib',
    },
    {
      path: 'example.txt',
      build,
      url: `/build/${build}/example.txt`,
      type: 'txt',
    },
    {
      path: 'output.log',
      build,
      url: `/build/${build}/output.log`,
      type: 'log',
    },
    {
      path: 'output.blg',
      build,
      url: `/build/${build}/output.blg`,
      type: 'blg',
    },
  ]
}

const compileFromCacheResponse = () => {
  return {
    fromCache: true,
    status: 'success',
    clsiServerId: 'foo',
    clsiCacheShard: 'clsi-cache-zone-b-shard-1',
    compileGroup: 'priority',
    pdfDownloadDomain: 'https://clsi.test-overleaf.com',
    outputFiles: outputFiles(),
    options: {
      rootResourcePath: 'main.tex',
      imageName: 'texlive-full:2024.1',
      compiler: 'pdflatex',
      stopOnFirstError: false,
      draft: false,
    },
  }
}

export const interceptCompileFromCacheRequest = ({
  times,
  promise,
}: {
  times: number
  promise: Promise<void>
}) => {
  return cy.intercept(
    { path: '/project/*/output/cached/output.overleaf.json', times },
    async req => {
      await promise
      req.reply({ body: compileFromCacheResponse() })
    }
  )
}

export const interceptCompileRequest = ({ times = 1 } = {}) => {
  return cy.intercept(
    { method: 'POST', pathname: '/project/*/compile', times },
    {
      body: {
        status: 'success',
        clsiServerId: 'foo',
        compileGroup: 'priority',
        pdfDownloadDomain: 'https://clsi.test-overleaf.com',
        outputFiles: outputFiles(),
      },
    }
  )
}

export const interceptCompile = ({
  prefix = 'compile',
  times = 1,
  cached = false,
  regular = true,
  outputPDFFixture = 'output.pdf',
} = {}) => {
  if (cached) {
    cy.intercept(
      { path: '/project/*/output/cached/output.overleaf.json', times },
      { body: compileFromCacheResponse() }
    ).as(`${prefix}-cached`)
  } else {
    cy.intercept(
      { pathname: '/project/*/output/cached/output.overleaf.json', times },
      { statusCode: 404 }
    ).as(`${prefix}-cached`)
  }

  if (regular) {
    interceptCompileRequest({ times }).as(`${prefix}`)
  } else {
    cy.intercept(
      { method: 'POST', pathname: '/project/*/compile', times },
      {
        body: {
          status: 'unavailable',
          clsiServerId: 'foo',
          compileGroup: 'priority',
          pdfDownloadDomain: 'https://clsi.test-overleaf.com',
          outputFiles: [],
        },
      }
    ).as(`${prefix}`)
  }

  cy.intercept(
    { pathname: '/build/*/output.pdf', times },
    { fixture: `build/${outputPDFFixture},null` }
  ).as(`${prefix}-pdf`)

  cy.intercept(
    { pathname: '/build/*/output.log', times },
    { fixture: 'build/output.log' }
  ).as(`${prefix}-log`)

  cy.intercept(
    { pathname: '/build/*/output.blg', times },
    { fixture: 'build/output.blg' }
  ).as(`${prefix}-blg`)
}

export const waitForCompile = ({
  prefix = 'compile',
  pdf = false,
  cached = false,
  regular = true,
} = {}) => {
  if (cached) {
    cy.wait(`@${prefix}-cached`)
  }
  if (regular) {
    cy.wait(`@${prefix}`)
  }
  return waitForCompileOutput({ prefix, pdf, cached })
}

export const waitForCompileOutput = ({
  prefix = 'compile',
  pdf = false,
  cached = false,
} = {}) => {
  cy.wait(`@${prefix}-log`)
    .its('request.query.clsiserverid')
    .should('eq', cached ? 'clsi-cache-zone-b-shard-1' : 'foo') // straight from cache if cached
  cy.wait(`@${prefix}-blg`)
    .its('request.query.clsiserverid')
    .should('eq', cached ? 'clsi-cache-zone-b-shard-1' : 'foo') // straight from cache if cached
  if (pdf) {
    cy.wait(`@${prefix}-pdf`)
      .its('request.query.clsiserverid')
      .should('eq', 'foo') // always from VM first
  }
  return cy.wrap(null)
}

export const interceptDeferredCompile = (beforeResponse?: () => void) => {
  const { promise, resolve } = Promise.withResolvers<void>()

  cy.intercept(
    { method: 'POST', url: '/project/*/compile*', times: 1 },
    req => {
      if (beforeResponse) {
        beforeResponse()
      }

      // only reply once the Promise is resolved
      promise.then(() => {
        req.reply({
          body: {
            status: 'success',
            clsiServerId: 'foo',
            compileGroup: 'priority',
            pdfDownloadDomain: 'https://clsi.test-overleaf.com',
            outputFiles: [
              {
                path: 'output.pdf',
                build: '123',
                url: '/build/123/output.pdf',
                type: 'pdf',
              },
              {
                path: 'output.log',
                build: '123',
                url: '/build/123/output.log',
                type: 'log',
              },
              {
                path: 'output.blg',
                build: '123',
                url: '/build/123/output.blg',
                type: 'log',
              },
            ],
          },
        })
      })

      return promise
    }
  ).as('compile')

  cy.intercept(
    { pathname: '/build/*/output.pdf', times: 1 },
    { fixture: 'build/output.pdf,null' }
  ).as(`compile-pdf`)

  cy.intercept(
    { pathname: '/build/*/output.log', times: 1 },
    { fixture: 'build/output.log' }
  ).as(`compile-log`)

  cy.intercept(
    { pathname: '/build/*/output.blg', times: 1 },
    { fixture: 'build/output.blg' }
  ).as(`compile-blg`)

  return cy.wrap(resolve)
}
