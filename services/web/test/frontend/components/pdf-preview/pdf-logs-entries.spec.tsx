import { EditorProviders } from '../../helpers/editor-providers'
import PdfLogsEntries from '../../../../frontend/js/features/pdf-preview/components/pdf-logs-entries'
import { detachChannel, testDetachChannel } from '../../helpers/detach-channel'
window.metaAttributesCache = new Map([['ol-debugPdfDetach', true]])

describe('<PdfLogsEntries/>', function () {
  const fakeEntity = { type: 'doc' }

  const logEntries = [
    {
      file: 'main.tex',
      line: 9,
      column: 8,
      level: 'error',
      message: 'LaTeX Error',
      content: 'See the LaTeX manual',
      raw: '',
      ruleId: 'hint_misplaced_alignment_tab_character',
      key: '',
    },
  ]

  let props: Record<string, any>

  beforeEach(function () {
    props = {
      fileTreeManager: {
        findEntityByPath: cy.stub().as('findEntityByPath').returns(fakeEntity),
      },
      editorManager: {
        openDoc: cy.spy().as('openDoc'),
      },
    }

    cy.interceptCompile()
    cy.interceptEvents()
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
  })

  it('displays human readable hint', function () {
    cy.mount(
      <EditorProviders {...props}>
        <PdfLogsEntries entries={logEntries} />
      </EditorProviders>
    )

    cy.contains('You have placed an alignment tab character')
  })

  it('opens doc on click', function () {
    cy.mount(
      <EditorProviders {...props}>
        <PdfLogsEntries entries={logEntries} />
      </EditorProviders>
    )

    cy.findByRole('button', {
      name: 'Navigate to log position in source code: main.tex, 9',
    }).click()

    cy.get('@findEntityByPath').should('have.been.calledOnce')
    cy.get('@openDoc').should('have.been.calledOnceWith', fakeEntity, {
      gotoLine: 9,
      gotoColumn: 8,
    })
  })

  it('opens doc via detached action', function () {
    cy.window().then(win => {
      win.metaAttributesCache = new Map([['ol-detachRole', 'detacher']])
    })

    cy.mount(
      <EditorProviders {...props}>
        <PdfLogsEntries entries={logEntries} />
      </EditorProviders>
    ).then(() => {
      testDetachChannel.postMessage({
        role: 'detached',
        event: 'action-sync-to-entry',
        data: {
          args: [
            {
              file: 'main.tex',
              line: 7,
              column: 6,
            },
          ],
        },
      })
    })

    cy.get('@findEntityByPath').should('have.been.calledOnce')
    cy.get('@openDoc').should('have.been.calledOnceWith', fakeEntity, {
      gotoLine: 7,
      gotoColumn: 6,
    })
  })

  it('sends open doc clicks via detached action', function () {
    cy.window().then(win => {
      win.metaAttributesCache = new Map([['ol-detachRole', 'detached']])
    })

    cy.mount(
      <EditorProviders {...props}>
        <PdfLogsEntries entries={logEntries} />
      </EditorProviders>
    )

    cy.spy(detachChannel, 'postMessage').as('postDetachMessage')

    cy.findByRole('button', {
      name: 'Navigate to log position in source code: main.tex, 9',
    }).click()

    cy.get('@findEntityByPath').should('not.have.been.called')
    cy.get('@openDoc').should('not.have.been.called')
    cy.get('@postDetachMessage').should('have.been.calledWith', {
      role: 'detached',
      event: 'action-sync-to-entry',
      data: {
        args: [
          {
            file: 'main.tex',
            line: 9,
            column: 8,
          },
        ],
      },
    })
  })
})
