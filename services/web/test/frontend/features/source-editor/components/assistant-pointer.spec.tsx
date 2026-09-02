import {
  EditorProviders,
  makeEditorPropertiesProvider,
  makeProjectProvider,
  USER_EMAIL,
  USER_ID,
} from '../../../helpers/editor-providers'
import CodemirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { mockScope } from '../helpers/mock-scope'
import { TestContainer } from '../helpers/test-container'
import { mockProject } from '../helpers/mock-project'

const mountEditor = (content: string) => {
  const scope = mockScope(content)

  const project = mockProject()

  cy.mount(
    <TestContainer>
      <EditorProviders
        scope={scope}
        user={{
          id: USER_ID,
          email: USER_EMAIL,
          signUpDate: '2025-10-10T10:10:10Z',
          hasPaidSubscription: true,
        }}
        providers={{
          ProjectProvider: makeProjectProvider(project),
          EditorPropertiesProvider: makeEditorPropertiesProvider({
            showVisual: false,
            showSymbolPalette: false,
          }),
        }}
      >
        <CodemirrorEditor />
      </EditorProviders>
    </TestContainer>
  )

  // wait for the content to be parsed and revealed
  cy.get('.cm-content').should('have.css', 'opacity', '1')
}

describe('assistant pointer', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    window.metaAttributesCache.set('ol-showAiFeatures', true)
    window.metaAttributesCache.set('ol-hasAiFreeTier', false)
    window.metaAttributesCache.set('ol-splitTestVariants', {
      'ai-assistant-pointer': 'tooltip',
    })
    cy.interceptEvents()
    cy.interceptMetadata()
  })

  const content = [
    '\\begin{table}',
    '  cell',
    '\\end{table}',
    '',
    'text outside',
    '',
  ].join('\n')

  it('shows the gutter icon when the cursor is inside a table environment', function () {
    mountEditor(content)

    cy.contains('.cm-line', 'cell').click()

    cy.findByRole('button', {
      name: 'Ask the AI assistant',
      hidden: true,
    }).should('exist')
  })

  it('hides the gutter icon when the cursor leaves the environment', function () {
    mountEditor(content)

    cy.contains('.cm-line', 'text outside').click()

    cy.findByRole('button', {
      name: 'Ask the AI assistant',
      hidden: true,
    }).should('not.exist')
  })

  it('dispatches the prompt event when the gutter icon is clicked', function () {
    mountEditor(content)

    const listener = cy.stub().as('openWithPrompt')
    cy.window().then(win => {
      win.addEventListener('ui:open-workbench-with-prompt', listener)
    })

    cy.contains('.cm-line', 'cell').click()

    cy.findByRole('button', {
      name: 'Ask the AI assistant',
      hidden: true,
    }).click()

    cy.get('@openWithPrompt').should('have.been.calledWithMatch', {
      detail: { prompt: "I'd like some help with this table: " },
    })
  })

  it('shows a hint tooltip on hover', function () {
    mountEditor(content)

    cy.contains('.cm-line', 'cell').click()

    cy.findByRole('button', {
      name: 'Ask the AI assistant',
      hidden: true,
    }).trigger('mouseover')

    cy.findByRole('tooltip').should(
      'contain.text',
      'Ask the AI assistant to change this table'
    )
  })

  it('updates the hint when moving to a different target', function () {
    mountEditor(
      [
        '\\usepackage{graphicx}',
        '',
        '\\begin{figure}',
        '  \\centering',
        '\\end{figure}',
        '',
      ].join('\n')
    )

    // click at the line start, so the cursor is inside the \usepackage node
    cy.contains('.cm-line', 'graphicx').click('left')

    cy.findByRole('button', {
      name: 'Ask the AI assistant',
      hidden: true,
    }).trigger('mouseover')
    cy.findByRole('tooltip').should(
      'contain.text',
      'Ask the AI assistant to explain this package'
    )

    cy.contains('.cm-line', 'centering').click()

    cy.findByRole('button', {
      name: 'Ask the AI assistant',
      hidden: true,
    }).trigger('mouseover')
    cy.findByRole('tooltip').should(
      'contain.text',
      'Ask the AI assistant to change this figure'
    )
  })
})
