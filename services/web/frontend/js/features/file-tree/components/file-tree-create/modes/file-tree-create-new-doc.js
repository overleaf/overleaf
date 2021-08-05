import { useCallback, useEffect } from 'react'
import FileTreeCreateNameInput from '../file-tree-create-name-input'
import { useFileTreeActionable } from '../../../contexts/file-tree-actionable'
import { useFileTreeCreateName } from '../../../contexts/file-tree-create-name'
import { useFileTreeCreateForm } from '../../../contexts/file-tree-create-form'
import ErrorMessage from '../error-message'

export default function FileTreeCreateNewDoc() {
  const { name, validName } = useFileTreeCreateName()
  const { setValid } = useFileTreeCreateForm()
  const { error, finishCreatingDoc } = useFileTreeActionable()

  // form validation: name is valid
  useEffect(() => {
    setValid(validName)
  }, [setValid, validName])

  // form submission: create an empty doc with this name
  const handleSubmit = useCallback(
    event => {
      event.preventDefault()

      finishCreatingDoc({ name })
    },
    [finishCreatingDoc, name]
  )

  return (
    <form noValidate id="create-file" onSubmit={handleSubmit}>
      <FileTreeCreateNameInput focusName error={error} />

      {error && <ErrorMessage error={error} />}
    </form>
  )
}
