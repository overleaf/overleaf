import { Toolbar } from '@/features/ide-react/components/toolbar/toolbar'
import {
  EditorProviders,
  makeEditorProvider,
} from '../../../helpers/editor-providers'
import { Cobranding } from '@ol-types/cobranding'
import partnerLogoUrl from './cobranding-logo.png'

describe('<Toolbar />', function () {
  describe('cobranding', function () {
    beforeEach(function () {
      const cobranding: Cobranding = {
        logoImgUrl: partnerLogoUrl,
        brandVariationName: 'brand variation name',
        brandVariationId: 1000,
        brandId: 2000,
        brandVariationHomeUrl: 'https://brand.example.com',
        publishGuideHtml: 'string',
        partner: 'partner name',
        brandedMenu: true,
        submitBtnHtml: 'submit to\n partner',
        submitBtnHtmlNoBreaks: 'submit to partner',
      }

      cy.mount(
        <EditorProviders
          providers={{ EditorProvider: makeEditorProvider({ cobranding }) }}
        >
          <Toolbar />
        </EditorProviders>
      )
    })

    it('displays the cobranding logo', function () {
      cy.get(`img[src="${partnerLogoUrl}"]`).should('be.visible')
    })

    it('shows the branded submit button', function () {
      cy.findByRole('button', { name: 'submit to partner' }).should(
        'be.visible'
      )
    })
  })

  describe('no cobranding', function () {
    beforeEach(function () {
      cy.mount(
        <EditorProviders
          providers={{
            EditorProvider: makeEditorProvider({ cobranding: undefined }),
          }}
        >
          <Toolbar />
        </EditorProviders>
      )
    })

    it('does not display a cobranding logo', function () {
      cy.get('.ide-redesign-toolbar-cobranding-logo').should('not.exist')
    })

    it('does not show a submit button', function () {
      cy.findByRole('button', { name: 'Submit' }).should('not.exist')
    })
  })

  it('clicking the logo takes you to the home page', function () {
    cy.mount(
      <EditorProviders projectName="My title">
        <Toolbar />
      </EditorProviders>
    )
    cy.findByLabelText('Overleaf logo')
      // We can't click the link in component tests, so just look at the
      // parent directly
      .parent()
      .should('be.visible')
      .should('have.attr', 'href', '/project')
  })

  describe('project title menu', function () {
    beforeEach(function () {
      cy.mount(
        <EditorProviders
          projectName="My title"
          providers={{
            EditorProvider: makeEditorProvider({
              renameProject: cy.stub().as('rename-project'),
            }),
          }}
        >
          <Toolbar />
        </EditorProviders>
      )
    })

    it('displays the project title dropdown', function () {
      cy.findByRole('button', { name: 'Project title options' })
        .should('be.visible')
        .should('contain.text', 'My title')
        .click()

      cy.findByRole('menu')
        .should('exist')
        .within(() => {
          cy.findByRole('menuitem', { name: 'Download as PDF' }).should('exist')
          cy.findByRole('menuitem', {
            name: 'Download as source (.zip)',
          }).should('exist')
          cy.findByRole('menuitem', { name: 'Make a copy' }).should('exist')
          cy.findByRole('menuitem', { name: 'Rename' }).should('exist')
        })
    })

    it('allows the project to be renamed', function () {
      cy.findByRole('button', { name: 'Project title options' }).click()
      cy.findByRole('menuitem', { name: 'Rename' }).click()
      cy.findByRole('textbox')
        .should('be.visible')
        .should('have.value', 'My title')
        .type('New title{enter}')
      cy.get('@rename-project').should('have.been.calledWith', 'New title')
    })

    it('should show modal when copying project', function () {
      cy.findByRole('button', { name: 'Project title options' }).click()
      cy.findByRole('menuitem', { name: 'Make a copy' }).click()
      cy.findByRole('dialog')
        .should('be.visible')
        .should('contain.text', 'Copy project')
    })

    it('should show modal when pressing submit', function () {
      cy.findByRole('button', { name: 'Project title options' }).click()
      cy.findByRole('menuitem', { name: 'Submit' }).click()
      cy.findByRole('dialog')
        .should('be.visible')
        .should('contain.text', 'Submit')
    })
  })

  describe('history toggle', function () {
    it('Should show history button', function () {
      cy.mount(
        <EditorProviders
          projectName="My title"
          providers={{
            EditorProvider: makeEditorProvider({
              isRestrictedTokenMember: false,
            }),
          }}
        >
          <Toolbar />
        </EditorProviders>
      )
      cy.findByRole('button', { name: 'History' }).should('be.visible').click()
    })

    it('Should not show history button to restricted token members', function () {
      cy.mount(
        <EditorProviders
          projectName="My title"
          providers={{
            EditorProvider: makeEditorProvider({
              isRestrictedTokenMember: true,
            }),
          }}
        >
          <Toolbar />
        </EditorProviders>
      )
      cy.findByRole('button', { name: 'History' }).should('not.exist')
    })
  })

  it('should show share button', function () {
    cy.mount(
      <EditorProviders projectName="My title">
        <Toolbar />
      </EditorProviders>
    )
    cy.findByRole('button', { name: 'Share' }).should('be.visible').click()
    cy.findByRole('dialog')
      .should('be.visible')
      .should('contain.text', 'Share Project')
  })

  it('should show layout button', function () {
    cy.mount(
      <EditorProviders projectName="My title">
        <Toolbar />
      </EditorProviders>
    )
    cy.findByRole('button', { name: 'Layout options' })
      .should('be.visible')
      .click()
    cy.findByRole('menu')
      .should('exist')
      .within(() => {
        cy.findByRole('menuitem', { name: 'Split view' }).should('exist')
        cy.findByRole('menuitem', { name: 'Editor only' }).should('exist')
        cy.findByRole('menuitem', { name: 'PDF only' }).should('exist')
        cy.findByRole('menuitem', { name: 'Open PDF in separate tab' }).should(
          'exist'
        )
      })
  })

  describe('for non-owner', function () {
    it('should disable rename option', function () {
      cy.mount(
        <EditorProviders permissionsLevel="readOnly">
          <Toolbar />
        </EditorProviders>
      )
      cy.findByRole('button', { name: 'Project title options' }).click()
      // FIXME: This should really be a button rather than a link
      cy.findByRole('menuitem', { name: 'Rename' }).should(
        'have.class',
        'disabled'
      )
    })
  })

  describe('menu bar', function () {
    beforeEach(function () {
      cy.mount(
        <EditorProviders>
          <Toolbar />
        </EditorProviders>
      )
    })

    it('should have a menu bar role', function () {
      cy.findByRole('menubar').should('be.visible')
    })

    it('should show file, view & help', function () {
      cy.findByRole('menubar').within(() => {
        cy.findByRole('button', { name: 'File' }).should('be.visible')
        cy.findByRole('button', { name: 'View' }).should('be.visible')
        cy.findByRole('button', { name: 'Help' }).should('be.visible')
      })
    })

    // TODO: Test all the dynamic items
  })
})
