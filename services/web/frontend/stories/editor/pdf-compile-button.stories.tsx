import { FC } from 'react'
import type { Meta } from '@storybook/react'
import PdfCompileButton from '@/features/pdf-preview/components/pdf-compile-button'
import { ScopeDecorator } from '../decorators/scope'
import { CompileContext } from '@/shared/context/local-compile-context'
import { DetachCompileContext } from '@/shared/context/detach-compile-context'
import { bsVersionDecorator } from '../../../.storybook/utils/with-bootstrap-switcher'

export const CompileButton: FC<CompileContext> = (props: CompileContext) => (
  <DetachCompileContext.Provider value={props}>
    <div className="pdf m-5">
      <div className="toolbar toolbar-pdf toolbar-pdf-hybrid btn-toolbar">
        <div className="toolbar-pdf-left">
          <PdfCompileButton />
        </div>
      </div>
    </div>
  </DetachCompileContext.Provider>
)

const args: Partial<CompileContext> = {
  autoCompile: false,
  compiling: false,
  draft: false,
  hasChanges: false,
  stopOnFirstError: false,
  stopOnValidationError: false,
  animateCompileDropdownArrow: false,
}

const meta: Meta<typeof CompileButton> = {
  title: 'Editor / Toolbar / Compile Button',
  component: CompileButton,
  // @ts-ignore
  decorators: [ScopeDecorator],
  argTypes: {
    ...bsVersionDecorator.argTypes,
    startCompile: { action: 'startCompile' },
    setAutoCompile: { action: 'setAutoCompile' },
    setCompiling: { action: 'setCompiling' },
    setDraft: { action: 'setDraft' },
    setStopOnFirstError: { action: 'setStopOnFirstError' },
    setError: { action: 'setError' },
    setHasLintingError: { action: 'setHasLintingError' },
    setPosition: { action: 'setPosition' },
    setStopOnValidationError: { action: 'setStopOnValidationError' },
    recompileFromScratch: { action: 'recompileFromScratch' },
    stopCompile: { action: 'stopCompile' },
    setAnimateCompileDropdownArrow: {
      action: 'setAnimateCompileDropdownArrow',
    },
  },
  args,
}

export default meta
