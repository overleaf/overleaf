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

Cypress.Commands.add('interceptCompile', (prefix = 'compile') => {
  cy.intercept('POST', '/project/*/compile*', {
    body: {
      status: 'success',
      clsiServerId: 'foo',
      compileGroup: 'priority',
      pdfDownloadDomain: 'https://clsi.test-overleaf.com',
      outputFiles: outputFiles(),
    },
  }).as(`${prefix}`)

  cy.intercept('/build/*/output.pdf*', {
    fixture: 'build/output.pdf,null',
  }).as(`${prefix}-pdf`)

  cy.intercept('/build/*/output.log*', {
    fixture: 'build/output.log',
  }).as(`${prefix}-log`)

  cy.intercept('/build/*/output.blg*', {
    fixture: 'build/output.blg',
  }).as(`${prefix}-blg`)
})
