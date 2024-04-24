import FileTreeCreateNameInput from '../../../../../../frontend/js/features/file-tree/components/file-tree-create/file-tree-create-name-input'
import FileTreeCreateNameProvider from '../../../../../../frontend/js/features/file-tree/contexts/file-tree-create-name'

describe('<FileTreeCreateNameInput/>', function () {
  it('renders an empty input', function () {
    cy.mount(
      <FileTreeCreateNameProvider>
        <FileTreeCreateNameInput inFlight={false} />
      </FileTreeCreateNameProvider>
    )

    cy.findByLabelText('File Name')
    cy.findByPlaceholderText('File Name')
  })

  it('renders a custom label and placeholder', function () {
    cy.mount(
      <FileTreeCreateNameProvider>
        <FileTreeCreateNameInput
          label="File name in this project"
          placeholder="Enter a file name…"
          inFlight={false}
        />
      </FileTreeCreateNameProvider>
    )

    cy.findByLabelText('File name in this project')
    cy.findByPlaceholderText('Enter a file name…')
  })

  it('uses an initial name', function () {
    cy.mount(
      <FileTreeCreateNameProvider initialName="test.tex">
        <FileTreeCreateNameInput inFlight={false} />
      </FileTreeCreateNameProvider>
    )

    cy.findByLabelText('File Name').should('have.value', 'test.tex')
  })

  it('focuses the name', function () {
    cy.spy(window, 'requestAnimationFrame').as('requestAnimationFrame')

    cy.mount(
      <FileTreeCreateNameProvider initialName="test.tex">
        <FileTreeCreateNameInput focusName inFlight={false} />
      </FileTreeCreateNameProvider>
    )

    cy.findByLabelText('File Name').as('input')

    cy.get('@input').should('have.value', 'test.tex')

    cy.get('@requestAnimationFrame').should('have.been.calledOnce')

    // https://github.com/jsdom/jsdom/issues/2995
    // "window.getSelection doesn't work with selection of <input> element"
    // const selection = window.getSelection().toString()
    // expect(selection).to.equal('test')

    // wait for the selection to update
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(100)

    cy.get<HTMLInputElement>('@input').then(element => {
      expect(element.get(0).selectionStart).to.equal(0)
      expect(element.get(0).selectionEnd).to.equal(4)
    })
  })

  it('disables the input when in flight', function () {
    cy.mount(
      <FileTreeCreateNameProvider initialName="test.tex">
        <FileTreeCreateNameInput inFlight={false} />
      </FileTreeCreateNameProvider>
    ).then(({ rerender }) => {
      cy.findByLabelText('File Name').should('not.be.disabled')
      rerender(
        <FileTreeCreateNameProvider initialName="test.tex">
          <FileTreeCreateNameInput inFlight />
        </FileTreeCreateNameProvider>
      )
      cy.findByLabelText('File Name').should('be.disabled')
      rerender(
        <FileTreeCreateNameProvider initialName="test.tex">
          <FileTreeCreateNameInput inFlight={false} />
        </FileTreeCreateNameProvider>
      )
      cy.findByLabelText('File Name').should('not.be.disabled')
    })
  })
})
