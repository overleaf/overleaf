import CodeMirrorEditor from '../../../../frontend/js/features/source-editor/components/codemirror-editor'
import {
  EditorProviders,
  makeProjectProvider,
  USER_EMAIL,
  USER_ID,
} from '../../helpers/editor-providers'
import { mockScope } from '../source-editor/helpers/mock-scope'
import { TestContainer } from '../source-editor/helpers/test-container'
import { docId } from '../source-editor/helpers/mock-doc'
import { mockProject } from '../source-editor/helpers/mock-project'
import { UserId } from '@ol-types/user'

const userData = {
  avatar_text: 'User',
  email: USER_EMAIL,
  hue: 180,
  id: USER_ID,
  isSelf: true,
  first_name: 'Test',
  last_name: 'User',
}

const resolvedThreadId = 'resolved-thread-id'
const unresolvedThreadId = 'unresolved-thread-id'

describe('<ReviewPanel />', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)

    cy.interceptEvents()

    cy.intercept('GET', '/project/*/changes/users', [
      {
        id: USER_ID,
        email: USER_EMAIL,
        first_name: 'Test',
        last_name: 'User',
      },
    ])

    cy.intercept('GET', '/project/*/threads', {
      // Resolved comment thread
      [resolvedThreadId]: {
        messages: [
          {
            content: 'comment text',
            id: `${resolvedThreadId}-1`,
            timestamp: new Date('2025-01-01T00:00:00.000Z'),
            user: userData,
            user_id: USER_ID,
          },
        ],
        resolved: true,
        resolved_at: new Date('2025-01-02T00:00:00.000Z').toISOString(),
        resolved_by_user_id: USER_ID,
        resolved_by_user: userData,
      },
      // Unresolved comment thread
      [unresolvedThreadId]: {
        messages: [
          {
            content: 'unresolved comment text',
            id: `${unresolvedThreadId}-1`,
            timestamp: new Date('2025-01-01T00:00:00.000Z'),
            user: userData,
            user_id: USER_ID,
          },
          {
            content: 'reply to thread',
            id: `${unresolvedThreadId}-2`,
            timestamp: new Date('2025-01-01T01:00:00.000Z'),
            user: userData,
            user_id: USER_ID,
          },
        ],
      },
    })

    const commentOps = [
      {
        id: 'resolved-op-id',
        op: { p: 161, c: 'Your introduction', t: resolvedThreadId },
      },
      {
        id: 'unresolved-op-id',
        op: { p: 210, c: 'Your results', t: unresolvedThreadId },
      },
    ]

    const changesOps = [
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

    cy.intercept('GET', '/project/*/ranges', [
      {
        id: docId,
        ranges: {
          changes: changesOps,
          comments: commentOps,
          docId,
        },
      },
    ])

    cy.intercept(
      'POST',
      `/project/*/doc/${docId}/thread/${resolvedThreadId}/reopen`,
      {}
    ).as('reopenThread')

    cy.intercept(
      'POST',
      `/project/*/doc/${docId}/thread/${unresolvedThreadId}/resolve`,
      {}
    ).as('resolveThreadId')

    cy.intercept(
      'POST',
      `/project/*/thread/${unresolvedThreadId}/messages/${unresolvedThreadId}-1/edit`,
      {}
    ).as('editComment')

    cy.intercept(
      'POST',
      `/project/*/thread/${unresolvedThreadId}/messages`,
      {}
    ).as('addReply')

    cy.intercept(
      'POST',
      /\/project\/.*\/thread\/[a-z0-9]{24}\/messages/,
      {}
    ).as('addNewComment')

    cy.intercept(
      'DELETE',
      `/project/*/doc/${docId}/thread/${resolvedThreadId}`,
      {}
    ).as('deleteResolvedThread')

    cy.intercept(
      'DELETE',
      `/project/*/thread/${unresolvedThreadId}/messages/${unresolvedThreadId}-2`,
      {}
    ).as('deleteComment')

    cy.intercept(
      'DELETE',
      `/project/*/doc/${docId}/thread/${unresolvedThreadId}`,
      {}
    ).as('deleteThread')

    cy.intercept('POST', `/project/*/doc/${docId}/changes/accept`, {}).as(
      'acceptChange'
    )

    cy.intercept('POST', `/project/*/doc/${docId}/metadata`, {})

    const getChanges = cy.stub().as('getChanges').returns([])
    const removeChangeIds = cy.stub().as('removeChangeIds')

    const scope = mockScope(undefined, {
      docOptions: {
        rangesOptions: {
          comments: commentOps,
          changes: changesOps,
          getChanges,
          removeChangeIds,
        },
      },
    })
    const project = mockProject({
      projectOwner: {
        _id: USER_ID,
      },
      projectFeatures: { trackChanges: false, trackChangesVisible: true },
    })

    cy.wrap(scope).as('scope')

    cy.mount(
      <TestContainer className="rp-size-expanded">
        <EditorProviders
          // Disable tabs since the review panel is rendered differently
          // when tabs are enabled
          userSettings={{ editorTabs: false }}
          scope={scope}
          providers={{ ProjectProvider: makeProjectProvider(project) }}
        >
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    // Wait for the editor to be ready before interacting with it
    cy.get('.cm-content').should('have.css', 'opacity', '1')

    // Open the review panel with keyboard shortcut
    cy.findByText('contentLine 0').type('{command}j', { scrollBehavior: false })
    cy.findByText('contentLine 1').type('{ctrl}j', { scrollBehavior: false })

    cy.findByTestId('review-panel').as('review-panel')
  })

  describe('toolbar', function () {
    describe('resolved comments dropdown', function () {
      it('renders a dropdown of resolved comments', function () {
        // The dropdown button should be visible
        cy.findByLabelText('Resolved comments').click()
        // It should open the dropdown
        cy.findByRole('tooltip')
          .should('exist')
          .within(() => {
            // TODO: Fix selector
            cy.get(
              '.review-panel-resolved-comments-header .badge-content'
            ).should('contain.text', '1')
            // Should name the document with the comment
            cy.findByText('test.tex').should('exist')
            // Should show the comment text
            cy.findByText('comment text').should('exist')
            // Should show the author name
            // TODO: Fix selector
            cy.get('.review-panel-entry-user').should(
              'contain.text',
              'Test User'
            )
          })
      })

      it('reopens resolved comment', function () {
        cy.findByLabelText('Resolved comments').click()
        cy.findByRole('tooltip').within(() => {
          // Find the re-open icon button using the hidden label
          cy.findByText('Re-open').click({ force: true })
          // verify the reopen thread API call
          cy.wait('@reopenThread')

          // TODO: Figure out a way to plumb the websocket response back through
          // to the test so we can verify the comment is no longer resolved
          // cy.get(
          //   '.review-panel-resolved-comments-header .badge-content'
          // ).should('contain.text', '0')
        })
      })

      it('deletes resolved comment', function () {
        cy.findByLabelText('Resolved comments').click()
        cy.findByRole('tooltip').within(() => {
          // Find the Delete icon button using the hidden label
          cy.findByText('Delete').click({ force: true })
          // verify the delete thread API call
          cy.wait('@deleteResolvedThread')

          // TODO: Figure out a way to plumb the websocket response back through
          // to the test so we can verify the comment is no longer there
          // cy.get(
          //   '.review-panel-resolved-comments-header .badge-content'
          // ).should('contain.text', '0')
        })
      })
    })
  })

  describe('toggler', function () {
    it('should close panel when pressing close button', function () {
      cy.findByLabelText('Close').click({ scrollBehavior: false })
      // We should collapse to the mini state
      cy.get('.review-panel-mini').should('exist')
    })
  })

  describe('navigation', function () {
    it('renders navigation', function () {
      cy.get('@review-panel').within(() => {
        cy.findByRole('tab', { name: /current file/i })
        cy.findByRole('tab', { name: /overview/i })
      })
    })

    it('selects the active tab', function () {
      cy.get('@review-panel').within(() => {
        cy.findByRole('tab', { name: /current file/i }).should(
          'have.attr',
          'aria-selected',
          'true'
        )
        cy.findByRole('tab', { name: /overview/i }).should(
          'have.attr',
          'aria-selected',
          'false'
        )
        cy.findByRole('tab', { name: /overview/i }).click()
        cy.findByRole('tab', { name: /current file/i }).should(
          'have.attr',
          'aria-selected',
          'false'
        )
        cy.findByRole('tab', { name: /overview/i }).should(
          'have.attr',
          'aria-selected',
          'true'
        )
      })
    })
  })

  describe('comment entries', function () {
    it('shows threads and comments', function () {
      cy.get('@review-panel').within(() => {
        cy.findByText('unresolved comment text').should('exist')
        cy.findByText('reply to thread').should('exist')
      })
    })

    it('edits comment', function () {
      cy.get('@review-panel').within(() => {
        // TODO: Fix selector
        cy.get('.review-panel-comment-wrapper')
          .first()
          .within(() => {
            // Find the options icon button using the hidden label
            cy.findByText('More options')
              .first()
              .click({ force: true, scrollBehavior: false })
            cy.findByRole('menu').within(() => {
              cy.findByText('Edit').click({ scrollBehavior: false })
            })
            // The edit input is mounted in a shadow root, so pierce it to
            // reach the CodeMirror content.
            cy.get('.review-panel-comment-edit')
              .shadow()
              .find('.cm-content')
              .type('{selectAll}edited comment text{enter}', {
                scrollBehavior: false,
              })
            cy.wait('@editComment')
            // TODO: Figure out a way to plumb the websocket response back through
            // to the test so we can verify the comment is resolved
            // cy.findByText('edited comment text').should('exist')
          })
      })
    })

    it('deletes thread', function () {
      cy.get('@review-panel').within(() => {
        // TODO: Fix selector
        cy.get('.review-panel-comment-wrapper')
          .first()
          .within(() => {
            // Find the options icon button using the hidden label
            cy.findByText('More options')
              .first()
              .click({ force: true, scrollBehavior: false })
            cy.findByRole('menu').within(() => {
              cy.findByText('Delete').click({ scrollBehavior: false })
            })
          })
      })
      cy.findByRole('dialog').within(() => {
        cy.findByRole('button', { name: 'Delete' }).click()
      })
      cy.wait('@deleteThread')
      // TODO: Figure out a way to plumb the websocket response back through
      // to the test so we can verify the thread is deleted
      // cy.findByText('unresolved comment text').should('not.exist')
    })

    it('deletes reply', function () {
      cy.get('@review-panel').within(() => {
        // TODO: Fix selector
        cy.get('.review-panel-comment-wrapper')
          .eq(1)
          .within(() => {
            // Find the options icon button using the hidden label
            cy.findByText('More options')
              .first()
              .click({ force: true, scrollBehavior: false })
            cy.findByRole('menu').within(() => {
              cy.findByText('Delete').click({ scrollBehavior: false })
            })
          })
      })
      cy.findByRole('dialog').within(() => {
        cy.findByRole('button', { name: 'Delete' }).click()
      })
      cy.wait('@deleteComment')
      // TODO: Figure out a way to plumb the websocket response back through
      // to the test so we can verify the reply is deleted
      // cy.findByText('reply to thread').should('not.exist')
    })

    it('cancels comment deletion', function () {
      cy.get('@review-panel').within(() => {
        // TODO: Fix selector
        cy.get('.review-panel-comment-wrapper')
          .eq(1)
          .within(() => {
            // Find the options icon button using the hidden label
            cy.findByText('More options')
              .first()
              .click({ force: true, scrollBehavior: false })
            cy.findByRole('menu').within(() => {
              cy.findByText('Delete').click({ scrollBehavior: false })
            })
          })
      })
      cy.findByRole('dialog').within(() => {
        cy.findByRole('button', { name: 'Cancel' }).click()
      })
      cy.findByText('unresolved comment text').should('exist')
    })

    it('adds new comment (replies) to a thread', function () {
      cy.get('@review-panel').within(() => {
        // The reply input is mounted in a shadow root, so pierce it to reach
        // the CodeMirror content.
        cy.get('.review-panel-add-comment-editor.review-panel-comment-input')
          .shadow()
          .find('.cm-content')
          .type('a new reply{enter}', {
            scrollBehavior: false,
          })
      })
      cy.wait('@addReply')
    })

    it('resolves comment', function () {
      cy.get('@review-panel').within(() => {
        // Find the resolve icon button using the hidden label
        cy.findByText('Resolve comment').click({ force: true })
        cy.wait('@resolveThreadId')
        // TODO: Figure out a way to plumb the websocket response back through
        // to the test so we can verify the comment is resolved
        // cy.findByText('unresolved comment text').should('not.exist')
      })
    })
  })

  describe('change entries', function () {
    it('renders inserted entries in current file mode', function () {
      cy.get('@review-panel').within(() => {
        cy.findByText('Added:').should('exist')
        cy.findByText('introduction').should('exist')
      })
    })

    it('renders deleted entries in current file mode', function () {
      cy.get('@review-panel').within(() => {
        cy.findByText('Deleted:').should('exist')
        cy.findByText('beautiful').should('exist')
      })
    })

    it('accepts change', function () {
      cy.get('@review-panel').within(() => {
        // TODO: Fix selector
        cy.get('.review-panel-entry-insert').within(() => {
          // Find the accept icon button using the hidden label
          cy.findByText('Accept change').click({ force: true })
          cy.wait('@acceptChange')
        })

        // TODO: Fix selector
        cy.get('.review-panel-entry-delete').within(() => {
          // Find the accept icon button using the hidden label
          cy.findByText('Accept change').click({ force: true })
          cy.wait('@acceptChange')
        })
      })
    })

    it('rejects change', function () {
      cy.get('@review-panel').within(() => {
        // TODO: Fix selector
        cy.get('.review-panel-entry-insert').within(() => {
          // Find the reject icon button using the hidden label
          cy.findByText('Reject change').click({ force: true })
          cy.get('@getChanges').should('be.calledOnce')
        })
        // TODO: Fix selector
        cy.get('.review-panel-entry-delete').within(() => {
          // Find the reject icon button using the hidden label
          cy.findByText('Reject change').click({ force: true })
          cy.get('@getChanges').should('be.calledTwice')
        })
      })
    })
  })

  describe('aggregate change entries', function () {
    // eslint-disable-next-line mocha/no-pending-tests
    it.skip('renders changed entries in current file mode', function () {})

    // eslint-disable-next-line mocha/no-pending-tests
    it.skip('renders changed entries in overview mode', function () {})
  })

  describe('add comment entry', function () {
    beforeEach(function () {
      cy.findByText('contentLine 12').type(
        '{home}{shift}' + '{rightArrow}'.repeat(6),
        { scrollBehavior: false }
      )
      // TODO: Fix selector
      cy.get('.review-tooltip-add-comment-button').as('add-comment-button')
    })

    it('renders floating `add comment button`', function () {
      cy.get('@add-comment-button').should('exist')
    })

    it('can add comment', function () {
      cy.get('@add-comment-button').click({ scrollBehavior: false })
      cy.get('@review-panel').within(() => {
        // The add-comment editor is the CM6 input that is not a reply/edit
        // input (those also carry the review-panel-comment-input class). It is
        // mounted in a shadow root, so pierce it to reach the content.
        cy.get(
          '.review-panel-add-comment-editor:not(.review-panel-comment-input)'
        )
          .shadow()
          .find('.cm-content')
          .type('a new comment{enter}', {
            scrollBehavior: false,
          })
      })
      cy.wait('@addNewComment')
      // TODO : Figure out a way to plumb the websocket response back through
      // to the test so we can verify the comment is added
      // cy.findByText('a new comment').should('exist')
    })

    it('cancels adding comment', function () {
      cy.get('@add-comment-button').click({ scrollBehavior: false })
      cy.get('@review-panel').within(() => {
        cy.findByRole('button', { name: 'Cancel' }).click({
          scrollBehavior: false,
        })
      })
    })
  })

  describe('add comment tooltip visibility', function () {
    beforeEach(function () {
      cy.findByText('contentLine 12').type(
        '{home}{shift}' + '{rightArrow}'.repeat(6),
        { scrollBehavior: false }
      )
      cy.get('.review-tooltip-menu').should('exist')
    })

    it('hides the tooltip when clicking a toolbar button', function () {
      cy.findByRole('button', { name: 'Undo' }).click({ scrollBehavior: false })
      cy.get('.review-tooltip-menu').should('not.exist')
    })

    it('hides the tooltip when clicking outside the editor', function () {
      cy.get('@review-panel').click({ scrollBehavior: false })
      cy.get('.review-tooltip-menu').should('not.exist')
    })

    it('keeps the add comment button functional when clicked', function () {
      cy.get('.review-tooltip-add-comment-button').click({
        scrollBehavior: false,
      })
      cy.get('@review-panel').within(() => {
        cy.get(
          '.review-panel-add-comment-editor:not(.review-panel-comment-input)'
        ).should('exist')
      })
    })
  })

  describe('bulk actions entry', function () {
    beforeEach(function () {
      // Select a deletion and an insertion
      cy.findByText('\\maketitle').type(
        '{home}{shift}' + '{downArrow}'.repeat(10),
        { scrollBehavior: false }
      )
      cy.findByLabelText('Accept selected changes').as(
        'accept-selected-changes'
      )
      cy.findByLabelText('Reject selected changes').as(
        'reject-selected-changes'
      )
    })

    it('renders the reject and accept all buttons`', function () {
      cy.get('@accept-selected-changes').should('exist')
      cy.get('@reject-selected-changes').should('exist')
    })

    it('accepts all changes', function () {
      cy.get('@accept-selected-changes').click({ scrollBehavior: false })
      cy.findByRole('dialog').within(() => {
        cy.findByText(
          'Are you sure you want to accept the selected 2 changes?'
        ).should('exist')
        cy.findByRole('button', { name: 'OK' }).click({
          scrollBehavior: false,
        })
        cy.wait('@acceptChange')
        cy.get('@removeChangeIds').should('have.been.calledWith', [
          'inserted-op-id',
          'deleted-op-id',
        ])
      })
    })

    it('rejects all changes', function () {
      cy.get('@reject-selected-changes').click({ scrollBehavior: false })
      cy.findByRole('dialog').within(() => {
        cy.findByText(
          'Are you sure you want to reject the selected 2 changes?'
        ).should('exist')
        cy.findByRole('button', { name: 'OK' }).click({
          scrollBehavior: false,
        })
        cy.get('@getChanges').should('have.been.calledWith', [
          'inserted-op-id',
          'deleted-op-id',
        ])
      })
    })

    it('keeps the tooltip visible when cancelling the accept confirmation modal', function () {
      cy.get('@accept-selected-changes').click({ scrollBehavior: false })
      cy.findByRole('dialog').within(() => {
        cy.findByRole('button', { name: 'Cancel' }).click({
          scrollBehavior: false,
        })
      })
      cy.get('.review-tooltip-menu').should('exist')
    })

    it('keeps the tooltip visible when cancelling the reject confirmation modal', function () {
      cy.get('@reject-selected-changes').click({ scrollBehavior: false })
      cy.findByRole('dialog').within(() => {
        cy.findByRole('button', { name: 'Cancel' }).click({
          scrollBehavior: false,
        })
      })
      cy.get('.review-tooltip-menu').should('exist')
    })
  })

  describe('overview mode', function () {
    beforeEach(function () {
      cy.findByRole('tab', { name: /overview/i }).click()
    })
    it('shows list of files changed', function () {
      // TODO: Fix selector
      cy.get('.collapsible-file-header').should('contain.text', 'test.tex')
    })

    it('renders comments', function () {
      cy.get('@review-panel').within(() => {
        cy.findByText('unresolved comment text').should('exist')
        cy.findByText('reply to thread').should('exist')
      })
    })

    it('renders changes', function () {
      cy.get('@review-panel').within(() => {
        cy.findByText('Added:').should('exist')
        cy.findByText('introduction').should('exist')
        cy.findByText('Deleted:').should('exist')
        cy.findByText('beautiful').should('exist')
      })
    })

    it('collapses the file entries when clicked', function () {
      cy.findByText('test.tex').click()
      cy.get('@review-panel').within(() => {
        // TODO: Fix selector
        cy.get('.review-panel-entry').should('not.exist')
      })
      cy.findByText('test.tex').click()
      cy.get('@review-panel').within(() => {
        // TODO: Fix selector
        cy.get('.review-panel-entry').should('exist')
      })
    })
  })
})

describe('<ReviewPanel /> resolved comment in another file', function () {
  const otherDocId = 'fake-nested-doc-id'
  const otherDocThreadId = 'other-doc-thread-id'

  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptEvents()
    cy.intercept('GET', '/project/*/changes/users', [])

    cy.intercept('GET', '/project/*/threads', {
      [otherDocThreadId]: {
        messages: [
          {
            content: 'comment in another file',
            id: `${otherDocThreadId}-1`,
            timestamp: new Date('2025-01-01T00:00:00.000Z'),
            user: userData,
            user_id: USER_ID,
          },
        ],
        resolved: true,
        resolved_at: new Date('2025-01-02T00:00:00.000Z').toISOString(),
        resolved_by_user_id: USER_ID,
        resolved_by_user: userData,
      },
    })

    cy.intercept('GET', '/project/*/ranges', [
      {
        id: otherDocId,
        ranges: {
          changes: [],
          comments: [
            {
              id: 'other-doc-op-id',
              op: { p: 161, c: 'Your introduction', t: otherDocThreadId },
            },
          ],
          docId: otherDocId,
        },
      },
    ])

    cy.intercept(
      'POST',
      `/project/*/doc/${otherDocId}/thread/${otherDocThreadId}/reopen`,
      {}
    ).as('reopenThreadInOtherDoc')

    cy.intercept(
      'DELETE',
      `/project/*/doc/${otherDocId}/thread/${otherDocThreadId}`,
      {}
    ).as('deleteThreadInOtherDoc')

    const scope = mockScope(undefined, {
      docOptions: {
        rangesOptions: { removeCommentId: cy.stub().as('removeCommentId') },
      },
    })
    const project = mockProject({
      projectOwner: { _id: USER_ID },
      projectFeatures: { trackChanges: false, trackChangesVisible: true },
    })

    cy.mount(
      <TestContainer className="rp-size-expanded">
        <EditorProviders
          // Disable tabs since the review panel is rendered differently
          // when tabs are enabled
          userSettings={{ editorTabs: false }}
          scope={scope}
          providers={{ ProjectProvider: makeProjectProvider(project) }}
        >
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    cy.get('.cm-content').should('have.css', 'opacity', '1')

    // Open the review panel with keyboard shortcut
    cy.findByText('contentLine 0').type('{command}j', { scrollBehavior: false })
    cy.findByText('contentLine 1').type('{ctrl}j', { scrollBehavior: false })

    cy.findByTestId('review-panel').should('exist')
  })

  it('names the other file in the resolved comments dropdown', function () {
    cy.findByLabelText('Resolved comments').click()
    cy.findByRole('tooltip').within(() => {
      cy.findByText('foo.tex').should('exist')
      cy.findByText('comment in another file').should('exist')
    })
  })

  it('deletes the comment using the doc id of the thread', function () {
    cy.findByLabelText('Resolved comments').click()
    cy.findByRole('tooltip').within(() => {
      cy.findByText('Delete').click({ force: true })
    })
    cy.wait('@deleteThreadInOtherDoc')
      .its('request.url')
      .should('contain', `/doc/${otherDocId}/thread/${otherDocThreadId}`)
  })

  it('leaves the ranges of the open document alone when deleting', function () {
    cy.findByLabelText('Resolved comments').click()
    cy.findByRole('tooltip').within(() => {
      cy.findByText('Delete').click({ force: true })
    })
    cy.wait('@deleteThreadInOtherDoc')
    cy.get('@removeCommentId').should('not.have.been.called')
  })

  it('reopens the comment using the doc id of the thread', function () {
    cy.findByLabelText('Resolved comments').click()
    cy.findByRole('tooltip').within(() => {
      cy.findByText('Re-open').click({ force: true })
    })
    cy.wait('@reopenThreadInOtherDoc')
      .its('request.url')
      .should('contain', `/doc/${otherDocId}/thread/${otherDocThreadId}/reopen`)
  })
})

describe('<ReviewPanel /> unresolved comment in another file', function () {
  const otherDocId = 'fake-nested-doc-id'
  const otherDocThreadId = 'other-doc-thread-id'

  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptEvents()
    cy.intercept('GET', '/project/*/changes/users', [])

    cy.intercept('GET', '/project/*/threads', {
      [otherDocThreadId]: {
        messages: [
          {
            content: 'comment in another file',
            id: `${otherDocThreadId}-1`,
            timestamp: new Date('2025-01-01T00:00:00.000Z'),
            user: userData,
            user_id: USER_ID,
          },
        ],
      },
    })

    cy.intercept('GET', '/project/*/ranges', [
      {
        id: otherDocId,
        ranges: {
          changes: [],
          comments: [
            {
              id: 'other-doc-op-id',
              op: { p: 161, c: 'Your introduction', t: otherDocThreadId },
            },
          ],
          docId: otherDocId,
        },
      },
    ])

    cy.intercept(
      'POST',
      `/project/*/doc/${otherDocId}/thread/${otherDocThreadId}/resolve`,
      {}
    ).as('resolveThreadInOtherDoc')

    cy.intercept(
      'DELETE',
      `/project/*/doc/${otherDocId}/thread/${otherDocThreadId}`,
      {}
    ).as('deleteThreadInOtherDoc')

    const scope = mockScope()
    const project = mockProject({
      projectOwner: { _id: USER_ID },
      projectFeatures: { trackChanges: false, trackChangesVisible: true },
    })

    cy.mount(
      <TestContainer className="rp-size-expanded">
        <EditorProviders
          scope={scope}
          providers={{ ProjectProvider: makeProjectProvider(project) }}
        >
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    cy.get('.cm-content').should('have.css', 'opacity', '1')

    // Open the review panel with keyboard shortcut
    cy.findByText('contentLine 0').type('{command}j', { scrollBehavior: false })
    cy.findByText('contentLine 1').type('{ctrl}j', { scrollBehavior: false })

    cy.findByTestId('review-panel').should('exist')

    // Overview mode lists the comments of every file, not just the open one
    cy.findByRole('tab', { name: /overview/i }).click()
    cy.findByText('comment in another file').should('exist')
  })

  it('resolves the comment using the doc id of the thread', function () {
    // Find the resolve icon button using the hidden label
    cy.findByText('Resolve comment').click({ force: true })
    cy.wait('@resolveThreadInOtherDoc')
      .its('request.url')
      .should(
        'contain',
        `/doc/${otherDocId}/thread/${otherDocThreadId}/resolve`
      )
  })

  it('deletes the comment using the doc id of the thread', function () {
    // Find the options icon button using the hidden label
    cy.findByText('More options')
      .first()
      .click({ force: true, scrollBehavior: false })
    cy.findByRole('menu').within(() => {
      cy.findByText('Delete').click({ scrollBehavior: false })
    })
    cy.findByRole('dialog').within(() => {
      cy.findByRole('button', { name: 'Delete' }).click()
    })
    cy.wait('@deleteThreadInOtherDoc')
      .its('request.url')
      .should('contain', `/doc/${otherDocId}/thread/${otherDocThreadId}`)
  })
})

describe('<ReviewPanel /> resolved comment in another file (history OT)', function () {
  const otherDocId = 'fake-nested-doc-id'
  const otherDocPath = 'figures/foo.tex'
  const otherDocThreadId = 'other-doc-thread-id'
  const quotedText = 'Your introduction'

  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    window.metaAttributesCache.set('ol-otMigrationStage', 1)
    cy.interceptEvents()
    cy.intercept('GET', '/project/*/changes/users', [])

    cy.intercept('GET', '/project/*/threads', {
      [otherDocThreadId]: {
        messages: [
          {
            content: 'comment in another file',
            id: `${otherDocThreadId}-1`,
            timestamp: new Date('2025-01-01T00:00:00.000Z'),
            user: userData,
            user_id: USER_ID,
          },
        ],
        resolved: true,
        resolved_at: new Date('2025-01-02T00:00:00.000Z').toISOString(),
        resolved_by_user_id: USER_ID,
        resolved_by_user: userData,
      },
    })

    // In history OT the resolved comments menu reads project ranges from the
    // project snapshot rather than from /project/:id/ranges. Inline the file
    // content in the chunk so no blobs need fetching.
    cy.intercept('POST', '/project/*/flush', { statusCode: 204 })
    cy.intercept('GET', '/project/*/changes?*', { body: [] })
    cy.intercept('GET', '/project/*/latest/history', {
      body: {
        chunk: {
          history: {
            snapshot: {
              files: {
                [otherDocPath]: {
                  content: quotedText,
                  comments: [
                    {
                      id: otherDocThreadId,
                      ranges: [{ pos: 0, length: quotedText.length }],
                      resolved: true,
                    },
                  ],
                },
              },
            },
            changes: [],
          },
          startVersion: 0,
        },
      },
    })

    cy.intercept(
      'POST',
      `/project/*/doc/${otherDocId}/thread/${otherDocThreadId}/reopen`,
      {}
    ).as('reopenThreadInOtherDoc')

    cy.intercept(
      'DELETE',
      `/project/*/doc/${otherDocId}/thread/${otherDocThreadId}`,
      {}
    ).as('deleteThreadInOtherDoc')

    const scope = mockScope(undefined, { docOptions: { historyOT: true } })
    const project = mockProject({
      projectOwner: { _id: USER_ID },
      projectFeatures: { trackChanges: false, trackChangesVisible: true },
    })

    cy.mount(
      <TestContainer className="rp-size-expanded">
        <EditorProviders
          // Disable tabs since the review panel is rendered differently
          // when tabs are enabled
          userSettings={{ editorTabs: false }}
          scope={scope}
          providers={{ ProjectProvider: makeProjectProvider(project) }}
        >
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    cy.get('.cm-content').should('have.css', 'opacity', '1')

    // Open the review panel with keyboard shortcut
    cy.findByText('contentLine 0').type('{command}j', { scrollBehavior: false })
    cy.findByText('contentLine 1').type('{ctrl}j', { scrollBehavior: false })

    cy.findByTestId('review-panel').should('exist')
  })

  it('names the other file in the resolved comments dropdown', function () {
    cy.findByLabelText('Resolved comments').click()
    cy.findByRole('tooltip').within(() => {
      cy.findByText('foo.tex').should('exist')
      cy.findByText('comment in another file').should('exist')
    })
  })

  it('deletes the comment over HTTP rather than submitting an op', function () {
    // Opening the panel edits the doc, which submits ops of its own
    cy.get('@historyOTSubmitOp').invoke('resetHistory')
    cy.findByLabelText('Resolved comments').click()
    cy.findByRole('tooltip').within(() => {
      cy.findByText('Delete').click({ force: true })
    })
    cy.wait('@deleteThreadInOtherDoc')
      .its('request.url')
      .should('contain', `/doc/${otherDocId}/thread/${otherDocThreadId}`)
    cy.get('@historyOTSubmitOp').should('not.have.been.called')
  })

  it('reopens the comment over HTTP rather than submitting an op', function () {
    // Opening the panel edits the doc, which submits ops of its own
    cy.get('@historyOTSubmitOp').invoke('resetHistory')
    cy.findByLabelText('Resolved comments').click()
    cy.findByRole('tooltip').within(() => {
      cy.findByText('Re-open').click({ force: true })
    })
    cy.wait('@reopenThreadInOtherDoc')
      .its('request.url')
      .should('contain', `/doc/${otherDocId}/thread/${otherDocThreadId}/reopen`)
    cy.get('@historyOTSubmitOp').should('not.have.been.called')
  })
})

describe('<ReviewPanel /> review tooltip without write permission', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptEvents()
    cy.intercept('GET', '/project/*/changes/users', [])
    cy.intercept('GET', '/project/*/threads', {})

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

    const scope = mockScope(undefined, {
      docOptions: { rangesOptions: { changes } },
      permissionsLevel: 'review',
    })
    const project = mockProject({
      projectOwner: { _id: USER_ID },
      projectFeatures: { trackChanges: true, trackChangesVisible: true },
    })

    cy.mount(
      <TestContainer className="rp-size-expanded">
        <EditorProviders
          scope={scope}
          providers={{ ProjectProvider: makeProjectProvider(project) }}
        >
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    cy.get('.cm-content').should('have.css', 'opacity', '1')

    // Select a deletion and an insertion so the tooltip's bulk actions would appear
    cy.findByText('\\maketitle').type(
      '{home}{shift}' + '{downArrow}'.repeat(10),
      { scrollBehavior: false }
    )
  })

  it('shows the comment action but hides accept and reject for a reviewer', function () {
    cy.get('.review-tooltip-menu').should('exist')
    cy.get('.review-tooltip-add-comment-button').should('exist')
    cy.findByLabelText('Accept selected changes').should('not.exist')
    cy.findByLabelText('Reject selected changes').should('not.exist')
  })
})

describe('<ReviewPanel /> in mini mode', function () {
  function render({ comments = [], changes = [], threads = {} }: any) {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)

    cy.interceptEvents()

    cy.intercept('GET', '/project/*/changes/users', [
      {
        id: USER_ID,
        email: USER_EMAIL,
        first_name: 'Test',
        last_name: 'User',
      },
    ])

    const getChanges = cy.stub().as('getChanges').returns([])
    const removeChangeIds = cy.stub().as('removeChangeIds')

    const scope = mockScope(undefined, {
      docOptions: {
        rangesOptions: {
          comments,
          changes,
          getChanges,
          removeChangeIds,
        },
      },
      projectFeatures: { trackChangesVisible: true },
    })

    const project = mockProject({
      projectFeatures: { trackChangesVisible: true },
    })

    cy.intercept('GET', '/project/*/ranges', [
      {
        id: docId,
        ranges: {
          changes,
          comments,
          docId,
        },
      },
    ])

    cy.intercept('GET', '/project/*/threads', threads).as('loadThreads')

    cy.intercept('POST', `/project/*/doc/${docId}/metadata`, {})

    cy.wrap(scope).as('scope')

    cy.mount(
      <TestContainer>
        <EditorProviders
          scope={scope}
          providers={{ ProjectProvider: makeProjectProvider(project) }}
        >
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )
    // Wait for editor
    cy.get('.cm-content').should('have.css', 'opacity', '1')

    // Wait for the threads to load, since mini mode renders conditionally on
    // the threads/ranges data being present
    cy.wait('@loadThreads')

    // Toggle the review panel twice to ensure data is loaded
    cy.findByText('contentLine 0').type('{command}jj', {
      scrollBehavior: false,
    })
    cy.findByText('contentLine 1').type('{ctrl}jj', { scrollBehavior: false })
  }

  it("doesn't render mini when no comments or changes are present in project", function () {
    render({
      comments: [],
      changes: [],
      threads: {},
    })
    cy.get('.review-panel-mini').should('not.exist')
  })

  it("doesn't render mini when no comments or changes are present in document", function () {
    render({
      comments: [],
      changes: [],
      threads: {
        'random-unrelated-thread': {
          messages: [
            {
              content: 'a comment',
              id: 'random-unrelated-thread-1',
              timestamp: new Date('2025-01-01T01:00:00.000Z'),
              user: userData,
              user_id: USER_ID,
            },
          ],
        },
      },
    })
    cy.get('.review-panel-mini').should('not.exist')
  })

  it("doesn't render mini when a resolved comment is present in document", function () {
    render({
      comments: [
        {
          id: resolvedThreadId,
          op: { p: 161, c: 'Your introduction', t: resolvedThreadId },
        },
      ],
      changes: [],
      threads: {
        [resolvedThreadId]: {
          resolved: true,
          resolved_at: new Date('2025-01-02T00:00:00.000Z').toISOString(),
          resolved_by_user_id: USER_ID,
          resolved_by_user: userData,
          messages: [
            {
              content: 'a comment',
              id: `${resolvedThreadId}-1`,
              timestamp: new Date('2025-01-01T01:00:00.000Z'),
              user: userData,
              user_id: USER_ID,
            },
          ],
        },
      },
    })
    cy.get('.review-panel-mini').should('not.exist')
  })

  it('renders mini when an unresolved comment is present in document', function () {
    render({
      comments: [
        {
          id: unresolvedThreadId,
          op: { p: 161, c: 'Your introduction', t: unresolvedThreadId },
        },
      ],
      changes: [],
      threads: {
        [unresolvedThreadId]: {
          messages: [
            {
              content: 'a comment',
              id: `${unresolvedThreadId}-1`,
              timestamp: new Date('2025-01-01T01:00:00.000Z'),
              user: userData,
              user_id: USER_ID,
            },
          ],
        },
      },
    })
    cy.get('.review-panel-mini').should('exist')
  })

  it('renders mini when a tracked change is present in document', function () {
    render({
      comments: [],
      changes: [
        {
          metadata: {
            user_id: USER_ID,
            ts: new Date('2025-01-01T00:00:00.000Z'),
          },
          id: 'inserted-op-id',
          op: { p: 166, t: 'inserted-op-id', i: 'introduction' },
        },
      ],
      threads: {},
    })
    cy.get('.review-panel-mini').should('exist')
  })
})

describe('<ReviewPanel /> for free users', function () {
  function mountEditor(ownerId = USER_ID) {
    const scope = mockScope(undefined, {
      permissions: { write: true, trackedWrite: false, comment: true },
    })
    const project = mockProject({
      projectFeatures: { trackChanges: false, trackChangesVisible: true },
      projectOwner: {
        _id: ownerId,
      },
    })

    cy.wrap(scope).as('scope')

    cy.mount(
      <TestContainer className="rp-size-expanded">
        <EditorProviders
          scope={scope}
          providers={{ ProjectProvider: makeProjectProvider(project) }}
        >
          <CodeMirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    // Wait for the editor to be ready before interacting with it
    cy.get('.cm-content').should('have.css', 'opacity', '1')

    cy.findByLabelText('Editing').click()
    cy.findByRole('menu').within(() => {
      cy.findByText(/Reviewing/).click()
    })
  }

  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptEvents()
    cy.intercept('GET', '/project/*/changes/users', [])
    cy.intercept('GET', '/project/*/threads', {})
  })

  it('renders modal', function () {
    mountEditor()
    cy.findByRole('dialog').within(() => {
      cy.findByText('Upgrade to review').should('exist')
    })
  })

  it('closes modal', function () {
    mountEditor()
    cy.findByRole('dialog').within(() => {
      cy.findByText('Close').click()
    })
    cy.findByRole('dialog').should('not.exist')
  })

  it('opens subscription page after clicking on `upgrade`', function () {
    mountEditor()
    cy.findByRole('dialog').within(() => {
      // Verify the button exists. Clicking it will open a new window
      cy.findByText('Upgrade').should('exist')
    })
  })

  // eslint-disable-next-line mocha/no-pending-tests
  it.skip('opens subscription page after clicking on `try it for free`', function () {})

  it('shows `ask project owner to upgrade` message', function () {
    mountEditor('other-user-id' as UserId)
    cy.findByRole('dialog').within(() => {
      cy.findByText(
        'Please ask the project owner to upgrade to use track changes'
      ).should('exist')
    })
  })
})
