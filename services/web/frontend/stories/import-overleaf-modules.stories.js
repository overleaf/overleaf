import React from 'react'

import importOverleafModules from '../macros/import-overleaf-module.macro'

const imports = importOverleafModules('storybook')

function ImportOverleafModulesMacroDemo() {
  if (!imports.length) {
    return (
      <div style={{ backgroundColor: 'white' }}>
        <p>
          You do not have any module imports configured. Add the following to
          your settings:
        </p>
        <code>
          {`moduleImports: { storybook: [PATH_TO_MODULE_THAT_EXPORTS_COMPONENT] }`}
        </code>
        <p>Then restart Storybook.</p>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: 'white' }}>
      {imports.map(({ import: { default: Component }, path }) => {
        return <Component key={path} />
      })}
    </div>
  )
}

export const Demo = args => <ImportOverleafModulesMacroDemo {...args} />

export default {
  title: 'importOverleafModule Macro'
}
