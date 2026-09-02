import { definePreview } from '@storybook/react-webpack5'
import addonA11y from '@storybook/addon-a11y'
import addonDesigns from '@storybook/addon-designs'
import addonDocs from '@storybook/addon-docs'
import addonLinks from '@storybook/addon-links'

// Storybook does not (currently) support async loading of "stories". Therefore
// the strategy in frontend/js/i18n.ts does not work (because we cannot wait on
// the promise to resolve).
// Therefore we have to use the synchronous method for configuring
// react-i18next. Because this, we can only hard-code a single language.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
// @ts-ignore
import en from '../../../services/web/locales/en.json'

function resetMeta() {
  window.metaAttributesCache = new Map()
  window.metaAttributesCache.set('ol-i18n', { currentLangCode: 'en' })
  window.metaAttributesCache.set('ol-capabilities', ['chat'])
  window.metaAttributesCache.set('ol-compileSettings', {
    compileTimeout: 20,
  })
  window.metaAttributesCache.set('ol-ExposedSettings', {
    adminEmail: 'placeholder@example.com',
    appName: 'Overleaf',
    cookieDomain: '.overleaf.stories',
    dropboxAppName: 'Overleaf-Stories',
    emailConfirmationDisabled: false,
    enableSubscriptions: true,
    hasAffiliationsFeature: false,
    hasLinkUrlFeature: true,
    hasLinkedProjectFileFeature: true,
    hasLinkedProjectOutputFileFeature: true,
    hasSamlFeature: true,
    ieeeBrandId: 15,
    isOverleaf: true,
    labsEnabled: true,
    maxEntitiesPerProject: 10,
    maxUploadSize: 5 * 1024 * 1024,
    recaptchaDisabled: {
      invite: true,
      login: true,
      passwordReset: true,
      register: true,
      addEmail: true,
    },
    sentryAllowedOriginRegex: '',
    siteUrl: 'http://localhost',
    templateLinks: [],
    textExtensions: [
      'tex',
      'latex',
      'sty',
      'cls',
      'bst',
      'bib',
      'bibtex',
      'txt',
      'tikz',
      'mtx',
      'rtex',
      'md',
      'asy',
      'lbx',
      'bbx',
      'cbx',
      'm',
      'lco',
      'dtx',
      'ins',
      'ist',
      'def',
      'clo',
      'ldf',
      'rmd',
      'lua',
      'gv',
      'mf',
      'lhs',
      'lean',
      'lean4',
      'hs',
      'mk',
      'xmpdata',
      'cfg',
      'rnw',
      'ltx',
      'inc',
    ],
    editableFilenames: ['latexmkrc', '.latexmkrc', 'makefile', 'gnumakefile'],
    validRootDocExtensions: ['tex', 'Rtex', 'ltx', 'Rnw'],
    fileIgnorePattern:
      '**/{{__MACOSX,.git,.texpadtmp,.R,.venv,venv}{,/**},.!(latexmkrc),*.{dvi,aux,log,toc,out,pdfsync,synctex,synctex(busy),fdb_latexmk,fls,nlo,ind,glo,gls,glg,bbl,blg,doc,docx,gz,swp}}',
    projectUploadTimeout: 12000,
  })
}

i18n.use(initReactI18next).init({
  lng: 'en',

  // still using the v3 plural suffixes
  compatibilityJSON: 'v3',

  resources: {
    en: { translation: en },
  },

  react: {
    useSuspense: false,
    transSupportBasicHtmlNodes: false,
  },

  interpolation: {
    prefix: '__',
    suffix: '__',
    unescapeSuffix: 'HTML',
    skipOnVariables: true,
    escapeValue: false,
    defaultVariables: {
      appName: 'Overleaf',
    },
  },
})

export default definePreview({
  addons: [addonA11y(), addonDesigns(), addonDocs(), addonLinks()],
  parameters: {
    // Automatically mark prop-types like onClick, onToggle, etc as Storybook
    // "actions", so that they are logged in the Actions pane at the bottom of the
    // viewer
    actions: { argTypesRegex: '^on.*' },
    docs: {
      story: {
        // render stories in iframes, to isolate modals
        inline: false,
      },
    },
    options: {
      storySort: {
        method: 'alphabetical',
        order: [
          'Storybook Guideline',
          ['Foundations', 'Storybook builds', 'Feature Flags'],
          'Shared',
        ],
      },
    },
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Page theme',
      // This drives the data-theme attribute that the decorator below puts on
      // every story, so it affects all of them and not just editor ones. Every
      // page outside the editor sets data-theme="light" (see layout-base.pug),
      // so that is what most stories should be drawn against. Defaulting to
      // dark was giving them dark page tokens on a white background, which
      // showed up as, among other things, a secondary button rendering dark
      // rather than light.
      defaultValue: 'main-light-',
      toolbar: {
        icon: 'circlehollow',
        items: [
          // The values are the stylesheet's own names for the two token sets,
          // so the dark one is "main-". The titles match what the product
          // calls them in the editor settings.
          { value: 'main-', title: 'Dark' },
          { value: 'main-light-', title: 'Light' },
        ],
      },
    },
  },
  loaders: [
    async () => {
      return {
        mainStyle: await import(
          // @ts-ignore
          `!!to-string-loader!css-loader!resolve-url-loader!sass-loader!../../../services/web/frontend/stylesheets/main-style.scss`
        ),
      }
    },
  ],
  decorators: [
    (Story, context) => {
      const { mainStyle } = context.loaded

      resetMeta()

      return (
        <div
          data-theme={
            context.globals.theme === 'main-light-' ? 'light' : 'default'
          }
        >
          {mainStyle && <style>{mainStyle.default}</style>}
          <Story {...context} />
        </div>
      )
    },
  ],
})

// Populate meta for top-level access in modules on import
resetMeta()
