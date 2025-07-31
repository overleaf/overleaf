import SwitchToPDFButton from '@/features/source-editor/components/switch-to-pdf-button'
import { EditorProviders } from '../../../helpers/editor-providers'

describe('<SwitchToPDFButton />', function () {
  it('shows button in full screen editor layout', function () {
    cy.mount(
      <EditorProviders
        layoutContext={{ view: 'editor', pdfLayout: 'flat', chatIsOpen: false }}
      >
        <SwitchToPDFButton />
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Switch to PDF' })
  })

  it('does not show button in split screen layout', function () {
    cy.mount(
      <EditorProviders
        layoutContext={{
          view: 'editor',
          pdfLayout: 'sideBySide',
          chatIsOpen: false,
        }}
      >
        <SwitchToPDFButton />
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Switch to PDF' }).should('not.exist')
  })

  it('does not show button when detached', function () {
    window.metaAttributesCache.set('ol-detachRole', 'detacher')

    cy.mount(
      <EditorProviders
        layoutContext={{ view: 'editor', pdfLayout: 'flat', chatIsOpen: false }}
      >
        <SwitchToPDFButton />
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Switch to PDF' }).should('not.exist')
  })
})
