import React from 'react'

const DefaultTheme = React.lazy(() => import('./default-theme'))
const LightTheme = React.lazy(() => import('./light-theme'))
const IEEETheme = React.lazy(() => import('./ieee-theme'))

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
  actions: { argTypesRegex: '^on.*' }
}

export const globalTypes = {
  theme: {
    name: 'Theme',
    description: 'Editor theme',
    defaultValue: 'default',
    toolbar: {
      icon: 'circlehollow',
      items: ['default', 'light', 'IEEE']
    }
  }
}

const withTheme = (Story, context) => {
  return (
    <>
      <React.Suspense fallback={<></>}>
        {context.globals.theme === 'default' && <DefaultTheme />}
        {context.globals.theme === 'light' && <LightTheme />}
        {context.globals.theme === 'IEEE' && <IEEETheme />}
      </React.Suspense>
      <Story {...context} />
    </>
  )
}
export const decorators = [withTheme]
