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

export const interceptCompile = (prefix = 'compile', times = 1) => {
  cy.intercept(
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
  ).as(`${prefix}`)

  cy.intercept(
    { pathname: '/build/*/output.pdf', times },
    { fixture: 'build/output.pdf,null' }
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

export const waitForCompile = ({ prefix = 'compile', pdf = false } = {}) => {
  cy.wait(`@${prefix}`)
  cy.wait(`@${prefix}-log`)
  cy.wait(`@${prefix}-blg`)
  if (pdf) {
    cy.wait(`@${prefix}-pdf`)
  }
  return cy.wrap(null)
}

export const interceptDeferredCompile = (beforeResponse?: () => void) => {
  let resolveDeferredCompile: (value?: unknown) => void

  const promise = new Promise(resolve => {
    resolveDeferredCompile = resolve
  })

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

  // @ts-ignore
  return cy.wrap(resolveDeferredCompile)
}
