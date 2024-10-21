import '../../../helpers/bootstrap-3'
import { mockScope } from '../helpers/mock-scope'
import { EditorProviders } from '../../../helpers/editor-providers'
import CodeMirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { TestContainer } from '../helpers/test-container'
import forEach from 'mocha-each'
import PackageVersions from '../../../../../app/src/infrastructure/PackageVersions'

const languages = [
  { code: 'en_GB', dic: 'en_GB', name: 'English (British)' },
  { code: 'fr', dic: 'fr', name: 'French' },
  { code: 'sv', dic: 'sv_SE', name: 'Swedish' },
]

const suggestions = {
  en_GB: ['medecine', 'medicine'],
  fr: ['medecin', 'médecin'],
  sv: ['medecin', 'medicin'],
}

forEach(Object.keys(suggestions)).describe(
  'Spell check in client (%s)',
  (spellCheckLanguage: keyof typeof suggestions) => {
    const content = `
\\documentclass{}

\\title{}
\\author{}

\\begin{document}
\\maketitle

\\begin{abstract}
\\end{abstract}

\\section{}

\\end{document}`

    beforeEach(function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-preventCompileOnLoad', true)
        win.metaAttributesCache.set('ol-splitTestVariants', {
          'spell-check-client': 'enabled',
        })
        win.metaAttributesCache.set('ol-splitTestInfo', {
          'spell-check-client': {
            phase: 'release',
          },
        })
        win.metaAttributesCache.set('ol-learnedWords', ['baz'])
        win.metaAttributesCache.set(
          'ol-dictionariesRoot',
          `js/dictionaries/${PackageVersions.version.dictionaries}/`
        )
        win.metaAttributesCache.set('ol-baseAssetPath', '/__cypress/src/')
        win.metaAttributesCache.set('ol-languages', languages)
      })

      cy.interceptEvents()

      const scope = mockScope(content)
      scope.project.spellCheckLanguage = spellCheckLanguage

      cy.mount(
        <TestContainer>
          <EditorProviders scope={scope}>
            <CodeMirrorEditor />
          </EditorProviders>
        </TestContainer>
      )

      cy.get('.cm-line').eq(13).as('line')
      cy.get('@line').click()
    })

    it('shows suggestions for misspelled word', function () {
      const [from, to] = suggestions[spellCheckLanguage]

      cy.get('@line').type(from)
      cy.get('@line').get('.ol-cm-spelling-error').contains(from)

      cy.get('@line').get('.ol-cm-spelling-error').rightclick()
      cy.findByText(to).click()
      cy.get('@line').contains(to)
      cy.get('@line').find('.ol-cm-spelling-error').should('not.exist')
    })
  }
)
