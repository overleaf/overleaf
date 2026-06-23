import CodeMirrorEditor from '../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { EditorProviders, USER_ID } from '../../helpers/editor-providers'
import { mockScope } from '../source-editor/helpers/mock-scope'
import { TestContainer } from '../source-editor/helpers/test-container'
import { docId } from '../source-editor/helpers/mock-doc'
import { useUserSettingsContext } from '@/shared/context/user-settings-context'
import type { PermissionsLevel } from '@/features/ide-react/types/permissions'

function FloatingMenuToggle() {
  const { setUserSettings } = useUserSettingsContext()
  return (
    <button
      onClick={() =>
        setUserSettings(settings => ({
          ...settings,
          floatingMenu: !settings.floatingMenu,
        }))
      }
    >
      Toggle floating menu
    </button>
  )
}

describe('<EditorFloatingMenu />', function () {
  function mountEditor({
    migrationEnabled,
    trackChangesVisible = true,
    floatingMenu = true,
    withSettingsToggle = false,
  }: {
    migrationEnabled: boolean
    trackChangesVisible?: boolean
    floatingMenu?: boolean
    withSettingsToggle?: boolean
  }) {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    window.metaAttributesCache.set('ol-splitTestVariants', {
      'writefull-toolbar-migration': migrationEnabled ? 'enabled' : 'default',
    })

    cy.interceptEvents()

    const scope = mockScope()

    cy.mount(
      <TestContainer>
        <EditorProviders
          scope={scope}
          features={{ trackChangesVisible }}
          userSettings={{ floatingMenu }}
        >
          <CodeMirrorEditor />
          {withSettingsToggle && <FloatingMenuToggle />}
        </EditorProviders>
      </TestContainer>
    )

    // Create a non-empty selection so the selection tooltip is shown.
    cy.findByText('contentLine 12').type(
      '{home}{shift}' + '{rightArrow}'.repeat(6),
      {
        scrollBehavior: false,
      }
    )
  }

  function mountEditorWithChanges({
    permissionsLevel,
  }: { permissionsLevel?: PermissionsLevel } = {}) {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    window.metaAttributesCache.set('ol-splitTestVariants', {
      'writefull-toolbar-migration': 'enabled',
    })

    cy.interceptEvents()
    cy.intercept('POST', `/project/*/doc/${docId}/changes/accept`, {}).as(
      'acceptChange'
    )

    const changes = [
      {
        metadata: {
          user_id: USER_ID,
          ts: new Date('2025-01-01T00:00:00.000Z'),
        },
        id: 'inserted-op-id',
        op: { p: 166, t: 'inserted-op-id', i: 'introduction' },
      },
      {
        metadata: {
          user_id: USER_ID,
          ts: new Date('2025-01-01T01:00:00.000Z'),
        },
        id: 'deleted-op-id',
        op: { p: 110, t: 'deleted-op-id', d: 'beautiful ' },
      },
    ]
    const getChanges = cy.stub().as('getChanges').returns([])
    const removeChangeIds = cy.stub().as('removeChangeIds')

    const scope = mockScope(undefined, {
      docOptions: {
        rangesOptions: { changes, getChanges, removeChangeIds },
      },
      permissionsLevel,
    })

    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope} features={{ trackChangesVisible: true }}>
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    // Select a deletion and an insertion so the bulk-action controls appear.
    cy.findByText('\\maketitle').type(
      '{home}{shift}' + '{downArrow}'.repeat(10),
      { scrollBehavior: false }
    )
  }

  describe('when the migration split test is enabled', function () {
    it('shows the unified floating menu with Add comment, not the legacy tooltip', function () {
      mountEditor({ migrationEnabled: true })

      cy.get('.editor-floating-menu').within(() => {
        cy.findByLabelText('Add comment').should('exist')
      })
      // Legacy tooltip is replaced.
      cy.get('.review-tooltip-menu').should('not.exist')
    })

    it('clicking Add comment dispatches the add-new-review-comment event', function () {
      mountEditor({ migrationEnabled: true })

      cy.window().then(win => {
        win.addEventListener(
          'add-new-review-comment',
          cy.stub().as('addComment')
        )
      })

      cy.get('.editor-floating-menu').within(() => {
        cy.findByLabelText('Add comment').click({ scrollBehavior: false })
      })

      cy.get('@addComment').should('have.been.called')
    })
  })

  describe('when the migration split test is disabled (control)', function () {
    it('keeps the legacy review tooltip and does not render the unified menu', function () {
      mountEditor({ migrationEnabled: false })

      cy.get('.review-tooltip-menu').should('exist')
      cy.get('.editor-floating-menu').should('not.exist')
    })
  })

  describe('floating menu setting', function () {
    it('does not show the unified floating menu when the migration split test is enabled', function () {
      mountEditor({ migrationEnabled: true, floatingMenu: false })

      cy.get('.editor-floating-menu').should('not.exist')
    })

    it('does not show the legacy review tooltip when the migration split test is disabled', function () {
      mountEditor({ migrationEnabled: false, floatingMenu: false })

      cy.get('.review-tooltip-menu').should('not.exist')
    })

    it('removes the menu and its tooltip when the setting is turned off', function () {
      mountEditor({
        migrationEnabled: true,
        floatingMenu: true,
        withSettingsToggle: true,
      })

      cy.get('.review-tooltip-menu-container').should('exist')
      cy.get('.editor-floating-menu').should('exist')

      // force: the visible menu can overlap this test-only toggle button
      cy.findByRole('button', { name: 'Toggle floating menu' }).click({
        scrollBehavior: false,
        force: true,
      })

      cy.get('.editor-floating-menu').should('not.exist')
      cy.get('.review-tooltip-menu-container').should('not.exist')
    })

    it('restores the menu when the setting is turned back on', function () {
      mountEditor({
        migrationEnabled: true,
        floatingMenu: false,
        withSettingsToggle: true,
      })

      cy.get('.editor-floating-menu').should('not.exist')

      cy.findByRole('button', { name: 'Toggle floating menu' }).click({
        scrollBehavior: false,
        force: true,
      })

      // delay: the extension reconfigures on a deferred dispatch, so spaced-out
      // keystrokes ensure a selection event lands after it to rebuild the menu
      cy.findByText('contentLine 12').type(
        '{home}{shift}' + '{rightArrow}'.repeat(6),
        { scrollBehavior: false, delay: 20 }
      )

      cy.get('.editor-floating-menu').should('exist')
    })
  })

  describe('bulk tracked-change actions', function () {
    beforeEach(function () {
      mountEditorWithChanges()
      cy.findByLabelText('Accept selected changes').as(
        'accept-selected-changes'
      )
      cy.findByLabelText('Reject selected changes').as(
        'reject-selected-changes'
      )
    })

    it('renders the accept and reject controls in the unified menu', function () {
      cy.get('.editor-floating-menu').should('exist')
      cy.get('@accept-selected-changes').should('exist')
      cy.get('@reject-selected-changes').should('exist')
    })

    it('accepts the selected changes', function () {
      cy.get('@accept-selected-changes').click({ scrollBehavior: false })
      cy.findByRole('dialog').within(() => {
        cy.findByText(
          'Are you sure you want to accept the selected 2 changes?'
        ).should('exist')
        cy.findByRole('button', { name: 'OK' }).click({ scrollBehavior: false })
      })
      cy.wait('@acceptChange')
      cy.get('@removeChangeIds').should('have.been.calledWith', [
        'inserted-op-id',
        'deleted-op-id',
      ])
    })

    it('rejects the selected changes', function () {
      cy.get('@reject-selected-changes').click({ scrollBehavior: false })
      cy.findByRole('dialog').within(() => {
        cy.findByText(
          'Are you sure you want to reject the selected 2 changes?'
        ).should('exist')
        cy.findByRole('button', { name: 'OK' }).click({ scrollBehavior: false })
      })
      cy.get('@getChanges').should('have.been.calledWith', [
        'inserted-op-id',
        'deleted-op-id',
      ])
    })

    it('keeps the menu visible when cancelling the confirmation modal', function () {
      cy.get('@accept-selected-changes').click({ scrollBehavior: false })
      cy.findByRole('dialog').within(() => {
        cy.findByRole('button', { name: 'Cancel' }).click({
          scrollBehavior: false,
        })
      })
      cy.get('.editor-floating-menu').should('exist')
    })
  })

  describe('bulk tracked-change actions without write permission', function () {
    it('hides the accept and reject controls for a reviewer', function () {
      mountEditorWithChanges({ permissionsLevel: 'review' })

      cy.get('.editor-floating-menu').within(() => {
        cy.findByLabelText('Add comment').should('exist')
      })
      cy.findByLabelText('Accept selected changes').should('not.exist')
      cy.findByLabelText('Reject selected changes').should('not.exist')
    })
  })
})
