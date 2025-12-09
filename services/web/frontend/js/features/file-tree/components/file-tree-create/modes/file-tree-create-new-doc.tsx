import { FormEventHandler, useCallback, useEffect } from 'react'
import FileTreeCreateNameInput from '../file-tree-create-name-input'
import { useFileTreeActionable } from '../../../contexts/file-tree-actionable'
import { useFileTreeCreateName } from '../../../contexts/file-tree-create-name'
import { useFileTreeCreateForm } from '../../../contexts/file-tree-create-form'
import * as eventTracking from '../../../../../infrastructure/event-tracking'
import ErrorMessage from '../error-message'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'

export default function FileTreeCreateNewDoc() {
  const { name, validName } = useFileTreeCreateName()
  const { setValid } = useFileTreeCreateForm()
  const { error, finishCreatingDoc, inFlight } = useFileTreeActionable()

  // form validation: name is valid
  useEffect(() => {
    setValid(validName)
  }, [setValid, validName])

  const { openDoc } = useEditorManagerContext()

  // form submission: create an empty doc with this name
  const handleSubmit: FormEventHandler = useCallback(
    async event => {
      event.preventDefault()

      const doc = await finishCreatingDoc({ name })
      eventTracking.sendMB('new-file-created', {
        method: 'doc',
        extension: name.split('.').length > 1 ? name.split('.').pop() : '',
      })

      if (doc) {
        return await openDoc(doc)
      }
    },
    [finishCreatingDoc, name, openDoc]
  )

  return (
    <form noValidate id="create-file" onSubmit={handleSubmit}>
      <FileTreeCreateNameInput focusName error={error} inFlight={inFlight} />
      {error && <ErrorMessage error={error} />}
    </form>
  )
}
