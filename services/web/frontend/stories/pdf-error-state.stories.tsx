import useFetchMock from './hooks/use-fetch-mock'
import { mockCompile } from './fixtures/compile'
import { ScopeDecorator, user } from './decorators/scope'
import PdfErrorState from '@/features/ide-redesign/components/pdf-preview/pdf-error-state'
import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import { useEffect } from 'react'
import PdfPreview from '@/features/pdf-preview/components/pdf-preview'

export default {
  title: 'Editor / PDF Error States',
  component: PdfErrorState,
}

const compileErrors = [
  'autocompile-backoff',
  'clear-cache',
  'clsi-maintenance',
  'compile-in-progress',
  'exited',
  'failure',
  'generic',
  'project-too-large',
  'rate-limited',
  'success',
  'terminated',
  'timedout',
  'too-recently-compiled',
  'unavailable',
  'validation-problems',
  'foo',
] as const

const ErrorPane = ({ error }: { error: (typeof compileErrors)[number] }) => {
  window.metaAttributesCache.set('ol-splitTestVariants', {
    'editor-redesign': 'enabled',
  })
  useFetchMock(fetchMock => {
    mockCompile(fetchMock)
  })
  const { setError } = useCompileContext()
  useEffect(() => {
    setError(error)
  }, [setError, error])

  return (
    <div className="ide-redesign-main">
      <span style={{ fontFamily: 'monospace' }}>{error}</span>
      <PdfPreview />
    </div>
  )
}

const story = {
  render: (args: { error: (typeof compileErrors)[number] }) => {
    return <ErrorPane error={args.error} />
  },
  argTypes: {
    error: {
      options: compileErrors,
      control: {
        type: 'select',
      },
    },
  },
  args: {
    error: compileErrors[0],
  },
}

export const PremiumUser = {
  ...story,
  decorators: [ScopeDecorator],
}

export const FreeUser = {
  ...story,
  decorators: [
    (Story: any) =>
      ScopeDecorator(
        Story,
        { mockCompileOnLoad: false },
        {
          'ol-user': {
            ...user,
            features: { ...user.features, compileTimeout: 20 },
          },
        }
      ),
  ],
}
