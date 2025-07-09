import { mockScope } from '../helpers/mock-scope'
import {
  EditorProviders,
  makeProjectProvider,
} from '../../../helpers/editor-providers'
import CodeMirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { TestContainer } from '../helpers/test-container'
import forEach from 'mocha-each'
import PackageVersions from '../../../../../app/src/infrastructure/PackageVersions'
import { mockProject } from '../helpers/mock-project'

const languages = [
  { code: 'af', dic: 'af_ZA', name: 'Afrikaans' },
  { code: 'an', dic: 'an_ES', name: 'Aragonese' },
  { code: 'ar', dic: 'ar', name: 'Arabic' },
  { code: 'be_BY', dic: 'be_BY', name: 'Belarusian' },
  { code: 'bg', dic: 'bg_BG', name: 'Bulgarian' },
  { code: 'bn_BD', dic: 'bn_BD', name: 'Bengali' },
  { code: 'bo', dic: 'bo', name: 'Tibetan' },
  { code: 'br', dic: 'br_FR', name: 'Breton' },
  { code: 'bs_BA', dic: 'bs_BA', name: 'Bosnian' },
  { code: 'ca', dic: 'ca', name: 'Catalan' },
  { code: 'cs', dic: 'cs_CZ', name: 'Czech' },
  { code: 'de', dic: 'de_DE', name: 'German' },
  { code: 'de_AT', dic: 'de_AT', name: 'German (Austria)' },
  { code: 'de_CH', dic: 'de_CH', name: 'German (Switzerland)' },
  { code: 'dz', dic: 'dz', name: 'Dzongkha' },
  { code: 'el', dic: 'el_GR', name: 'Greek' },
  { code: 'en_AU', dic: 'en_AU', name: 'English (Australian)' },
  { code: 'en_CA', dic: 'en_CA', name: 'English (Canadian)' },
  { code: 'en_GB', dic: 'en_GB', name: 'English (British)' },
  { code: 'en_US', dic: 'en_US', name: 'English (American)' },
  { code: 'en_ZA', dic: 'en_ZA', name: 'English (South African)' },
  { code: 'eo', dic: 'eo', name: 'Esperanto' },
  { code: 'es', dic: 'es_ES', name: 'Spanish' },
  { code: 'et', dic: 'et_EE', name: 'Estonian' },
  { code: 'eu', dic: 'eu', name: 'Basque' },
  { code: 'fa', dic: 'fa_IR', name: 'Persian' },
  { code: 'fo', dic: 'fo', name: 'Faroese' },
  { code: 'fr', dic: 'fr', name: 'French' },
  { code: 'ga', dic: 'ga_IE', name: 'Irish' },
  { code: 'gd_GB', dic: 'gd_GB', name: 'Scottish Gaelic' },
  { code: 'gl', dic: 'gl_ES', name: 'Galician' },
  { code: 'gu_IN', dic: 'gu_IN', name: 'Gujarati' },
  { code: 'gug_PY', dic: 'gug_PY', name: 'Guarani' },
  { code: 'he_IL', dic: 'he_IL', name: 'Hebrew' },
  { code: 'hi_IN', dic: 'hi_IN', name: 'Hindi' },
  { code: 'hr', dic: 'hr_HR', name: 'Croatian' },
  { code: 'hu_HU', dic: 'hu_HU', name: 'Hungarian' },
  { code: 'id', dic: 'id_ID', name: 'Indonesian' },
  { code: 'is_IS', dic: 'is_IS', name: 'Icelandic' },
  { code: 'it', dic: 'it_IT', name: 'Italian' },
  { code: 'kk', dic: 'kk_KZ', name: 'Kazakh' },
  { code: 'kmr', dic: 'kmr_Latn', name: 'Kurmanji' },
  { code: 'ko', dic: 'ko', name: 'Korean' },
  { code: 'lo_LA', dic: 'lo_LA', name: 'Laotian' },
  { code: 'lt', dic: 'lt_LT', name: 'Lithuanian' },
  { code: 'lv', dic: 'lv_LV', name: 'Latvian' },
  { code: 'ml_IN', dic: 'ml_IN', name: 'Malayalam' },
  { code: 'mn_MN', dic: 'mn_MN', name: 'Mongolian' },
  { code: 'nb_NO', dic: 'nb_NO', name: 'Norwegian (Bokmål)' },
  { code: 'ne_NP', dic: 'ne_NP', name: 'Nepali' },
  { code: 'nl', dic: 'nl', name: 'Dutch' },
  { code: 'nn_NO', dic: 'nn_NO', name: 'Norwegian (Nynorsk)' },
  { code: 'oc_FR', dic: 'oc_FR', name: 'Occitan' },
  { code: 'pl', dic: 'pl_PL', name: 'Polish' },
  { code: 'pt_BR', dic: 'pt_BR', name: 'Portuguese (Brazilian)' },
  { code: 'pt_PT', dic: 'pt_PT', name: 'Portuguese (European)' },
  { code: 'ro', dic: 'ro_RO', name: 'Romanian' },
  { code: 'ru', dic: 'ru_RU', name: 'Russian' },
  { code: 'si_LK', dic: 'si_LK', name: 'Sinhala' },
  { code: 'sk', dic: 'sk_SK', name: 'Slovak' },
  { code: 'sl', dic: 'sl_SI', name: 'Slovenian' },
  { code: 'sr_RS', dic: 'sr_RS', name: 'Serbian' },
  { code: 'sv', dic: 'sv_SE', name: 'Swedish' },
  { code: 'sw_TZ', dic: 'sw_TZ', name: 'Swahili' },
  { code: 'te_IN', dic: 'te_IN', name: 'Telugu' },
  { code: 'th_TH', dic: 'th_TH', name: 'Thai' },
  { code: 'tl', dic: 'tl', name: 'Tagalog' },
  { code: 'tr_TR', dic: 'tr_TR', name: 'Turkish' },
  { code: 'uz_UZ', dic: 'uz_UZ', name: 'Uzbek' },
  { code: 'vi_VN', dic: 'vi_VN', name: 'Vietnamese' },
]

const suggestions = {
  af: ['medicyne', 'medisyne'],
  be_BY: ['лекi', 'лекі'],
  bg: ['лекарствo', 'лекарство'],
  de: ['Medicin', 'Medizin'],
  en_CA: ['theatr', 'theatre'],
  en_GB: ['medecine', 'medicine'],
  en_US: ['theatr', 'theater'],
  es: ['medicaminto', 'medicamento'],
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
      const project = mockProject({ spellCheckLanguage })

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

      cy.get('.cm-line').eq(13).as('line')
      cy.get('@line').click()
    })

    it('shows suggestions for misspelled word', function () {
      const [from, to] = suggestions[spellCheckLanguage]

      cy.get('@line').type(`${from} ${to}`)
      cy.get('@line')
        .get('.ol-cm-spelling-error', { timeout: 10000 })
        .should('have.length', 1)
      cy.get('@line').get('.ol-cm-spelling-error').should('have.text', from)

      cy.get('@line').get('.ol-cm-spelling-error').rightclick()
      cy.findByRole('menuitem', { name: to }).click()
      cy.get('@line').contains(`${to} ${to}`)
      cy.get('@line').find('.ol-cm-spelling-error').should('not.exist')
    })
  }
)
