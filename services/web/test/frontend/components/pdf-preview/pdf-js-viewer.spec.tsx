import { EditorProviders } from '../../helpers/editor-providers'
import PdfJsViewer from '../../../../frontend/js/features/pdf-preview/components/pdf-js-viewer'
import { mockScope } from './scope'
import { getContainerEl } from 'cypress/react18'
import { unmountComponentAtNode } from 'react-dom'
import { PdfPreviewProvider } from '../../../../frontend/js/features/pdf-preview/components/pdf-preview-provider'

// Unicode directional isolates, added around placeables by @fluent/bundle/esm/resolver
const FSI = '\u2068'
const PDI = '\u2069'

describe('<PdfJSViewer/>', function () {
  beforeEach(function () {
    cy.interceptEvents()
  })

  it('loads all PDF pages', function () {
    cy.interceptCompile()

    const scope = mockScope()

    cy.mount(
      <EditorProviders scope={scope}>
        <PdfPreviewProvider>
          <div className="pdf-viewer">
            <PdfJsViewer url="/build/123/output.pdf?clsiserverid=foo" />
          </div>
        </PdfPreviewProvider>
      </EditorProviders>
    )

    cy.waitForCompile({ pdf: true })

    cy.findByTestId('pdfjs-viewer-inner').within(() => {
      cy.findByLabelText(`Page ${FSI}1${PDI}`)
      cy.findByLabelText(`Page ${FSI}2${PDI}`)
      cy.findByLabelText(`Page ${FSI}3${PDI}`)
      cy.findByLabelText(`Page ${FSI}4${PDI}`).should('not.exist')
    })

    cy.contains('Your Paper')
  })

  it('renders pages in a "loading" state', function () {
    cy.interceptCompile()

    const scope = mockScope()

    cy.mount(
      <EditorProviders scope={scope}>
        <PdfPreviewProvider>
          <div className="pdf-viewer">
            <PdfJsViewer url="/build/123/output.pdf" />
          </div>
        </PdfPreviewProvider>
      </EditorProviders>
    )

    cy.waitForCompile()

    cy.get('.page.loading')
  })

  it('can be unmounted while loading a document', function () {
    cy.interceptCompile()

    const scope = mockScope()

    cy.mount(
      <EditorProviders scope={scope}>
        <PdfPreviewProvider>
          <div className="pdf-viewer">
            <PdfJsViewer url="/build/123/output.pdf?clsiserverid=foo" />
          </div>
        </PdfPreviewProvider>
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
        <PdfPreviewProvider>
          <div className="pdf-viewer">
            <PdfJsViewer url="/build/123/output.pdf?clsiserverid=foo" />
          </div>
        </PdfPreviewProvider>
      </EditorProviders>
    )

    cy.waitForCompile({ pdf: true })

    cy.findByTestId('pdfjs-viewer-inner').within(() => {
      cy.findByLabelText(`Page ${FSI}1${PDI}`)
    })

    cy.then(() => unmountComponentAtNode(getContainerEl()))
  })
})
