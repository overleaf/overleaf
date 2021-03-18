import React from 'react'

import './preview.css'

// Storybook does not (currently) support async loading of "stories". Therefore
// the strategy in frontend/js/i18n.js does not work (because we cannot wait on
// the promise to resolve).
// Therefore we have to use the synchronous method for configuring
// react-i18next. Because this, we can only hard-code a single language.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en.json'
i18n.use(initReactI18next).init({
  lng: 'en',

  resources: {
    en: { translation: en }
  },

  react: {
    useSuspense: false
  },

  interpolation: {
    prefix: '__',
    suffix: '__',
    unescapeSuffix: 'HTML',
    skipOnVariables: true
  }
})

export const parameters = {
  // Automatically mark prop-types like onClick, onToggle, etc as Storybook
  // "actions", so that they are logged in the Actions pane at the bottom of the
  // viewer
  actions: { argTypesRegex: '^on.*' },
  docs: {
    // render stories in iframes, to isolate modals
    inlineStories: false
  }
}

export const globalTypes = {
  theme: {
    name: 'Theme',
    description: 'Editor theme',
    defaultValue: 'default-',
    toolbar: {
      icon: 'circlehollow',
      items: [
        { value: 'default-', title: 'Default' },
        { value: 'light-', title: 'Light' },
        { value: 'ieee-', title: 'IEEE' }
      ]
    }
  }
}

export const loaders = [
  async ({ globals }) => {
    const { theme } = globals

    return {
      // NOTE: this uses `${theme}style.less` rather than `${theme}.less`
      // so that webpack only bundles files ending with "style.less"
      activeStyle: await import(
        `../frontend/stylesheets/${theme === 'default-' ? '' : theme}style.less`
      )
    }
  }
]

const withTheme = (Story, context) => {
  const { activeStyle } = context.loaded

  return (
    <>
      {activeStyle && <style>{activeStyle.default}</style>}
      <Story {...context} />
    </>
  )
}

export const decorators = [withTheme]

window.ExposedSettings = {
  appName: 'Overleaf',
  maxEntitiesPerProject: 10,
  maxUploadSize: 5 * 1024 * 1024
}
