import { EditorProviders } from '../../helpers/editor-providers'
import PdfJsViewer from '../../../../frontend/js/features/pdf-preview/components/pdf-js-viewer'
import { mockScope } from './scope'
import { getContainerEl } from 'cypress/react'
import { unmountComponentAtNode } from 'react-dom'

describe('<PdfJSViewer/>', function () {
  beforeEach(function () {
    cy.interceptEvents()
  })

  it('loads all PDF pages', function () {
    cy.interceptCompile()

    const scope = mockScope()

    cy.mount(
      <EditorProviders scope={scope}>
        <div className="pdf-viewer">
          <PdfJsViewer url="/build/123/output.pdf" />
        </div>
      </EditorProviders>
    )

    cy.waitForCompile()

    cy.findByLabelText('Page 1')
    cy.findByLabelText('Page 2')
    cy.findByLabelText('Page 3')
    cy.findByLabelText('Page 4').should('not.exist')

    cy.contains('Your Paper')
  })

  it('renders pages in a "loading" state', function () {
    cy.interceptCompile()

    const scope = mockScope()

    cy.mount(
      <EditorProviders scope={scope}>
        <div className="pdf-viewer">
          <PdfJsViewer url="/build/123/output.pdf" />
        </div>
      </EditorProviders>
    )

    cy.waitForCompile()

    cy.findByLabelText('Loading…')
  })

  it('can be unmounted while loading a document', function () {
    cy.interceptCompile()

    const scope = mockScope()

    cy.mount(
      <EditorProviders scope={scope}>
        <div className="pdf-viewer">
          <PdfJsViewer url="/build/123/output.pdf" />
        </div>
      </EditorProviders>
    )

    cy.waitForCompile()

    cy.then(() => unmountComponentAtNode(getContainerEl()))
  })

  it('can be unmounted after loading a document', function () {
    cy.interceptCompile()

    const scope = mockScope()

    cy.mount(
      <EditorProviders scope={scope}>
        <div className="pdf-viewer">
          <PdfJsViewer url="/build/123/output.pdf" />
        </div>
      </EditorProviders>
    )

    cy.waitForCompile()

    cy.findByLabelText('Page 1')

    cy.then(() => unmountComponentAtNode(getContainerEl()))
  })
})
