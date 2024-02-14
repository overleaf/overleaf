import type { Preview } from '@storybook/react'

// Storybook does not (currently) support async loading of "stories". Therefore
// the strategy in frontend/js/i18n.js does not work (because we cannot wait on
// the promise to resolve).
// Therefore we have to use the synchronous method for configuring
// react-i18next. Because this, we can only hard-code a single language.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
// @ts-ignore
import en from '../../../services/web/locales/en.json'
import { ExposedSettings } from '../types/exposed-settings'
import { User } from '../types/user'

window.i18n = window.i18n || {}
window.i18n.currentLangCode = window.i18n.currentLangCode || 'en'
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

// avoid some errors by creating these objects in advance
window.user = {} as User
window.ExposedSettings = {} as ExposedSettings

const preview: Preview = {
  parameters: {
    // Automatically mark prop-types like onClick, onToggle, etc as Storybook
    // "actions", so that they are logged in the Actions pane at the bottom of the
    // viewer
    actions: { argTypesRegex: '^on.*' },
    docs: {
      // render stories in iframes, to isolate modals
      inlineStories: false,
    },
    // Default to Bootstrap 3 styles
    bootstrap5: false,
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Editor theme',
      defaultValue: 'main-',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'main-', title: 'Default' },
          { value: 'main-light-', title: 'Light' },
          { value: 'main-ieee-', title: 'IEEE' },
        ],
      },
    },
  },
  loaders: [
    async ({ globals }) => {
      const { theme } = globals

      return {
        // NOTE: this uses `${theme}style.less` rather than `${theme}.less`
        // so that webpack only bundles files ending with "style.less"
        bootstrap3Style: await import(
          `!!to-string-loader!css-loader!less-loader!../../../services/web/frontend/stylesheets/${theme}style.less`
        ),
        // NOTE: this uses `${theme}style.scss` rather than `${theme}.scss`
        // so that webpack only bundles files ending with "style.scss"
        bootstrap5Style: await import(
          `!!to-string-loader!css-loader!resolve-url-loader!sass-loader!../../../services/web/frontend/stylesheets/bootstrap-5/${theme}style.scss`
        ),
      }
    },
  ],
  decorators: [
    (Story, context) => {
      const { bootstrap3Style, bootstrap5Style } = context.loaded
      const activeStyle = context.parameters.bootstrap5
        ? bootstrap5Style
        : bootstrap3Style

      return (
        <>
          {activeStyle && <style>{activeStyle.default}</style>}
          <Story {...context} />
        </>
      )
    },
  ],
}

export default preview
