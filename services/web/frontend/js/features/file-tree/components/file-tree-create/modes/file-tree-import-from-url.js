import { ControlLabel, FormControl, FormGroup } from 'react-bootstrap'
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import FileTreeCreateNameInput from '../file-tree-create-name-input'
import { useFileTreeActionable } from '../../../contexts/file-tree-actionable'
import { useFileTreeCreateName } from '../../../contexts/file-tree-create-name'
import { useFileTreeCreateForm } from '../../../contexts/file-tree-create-form'
import ErrorMessage from '../error-message'

export default function FileTreeImportFromUrl() {
  const { t } = useTranslation()
  const { name, setName, validName } = useFileTreeCreateName()
  const { setValid } = useFileTreeCreateForm()
  const { finishCreatingLinkedFile, error } = useFileTreeActionable()

  const [url, setUrl] = useState('')

  const handleChange = useCallback(event => {
    setUrl(event.target.value)
  }, [])

  // set the name when the URL changes
  useEffect(() => {
    if (url) {
      const matches = url.match(/^https?:\/\/.+\/([^/]+\.(\w+))$/)
      setName(matches ? matches[1] : '')
    }
  }, [setName, url])

  // form validation: URL is set and name is valid
  useEffect(() => {
    setValid(validName && !!url)
  }, [setValid, validName, url])

  // form submission: create a linked file with this name, from this URL
  const handleSubmit = event => {
    event.preventDefault()

    finishCreatingLinkedFile({
      name,
      provider: 'url',
      data: { url },
    })
  }

  return (
    <form
      className="form-controls"
      id="create-file"
      noValidate
      onSubmit={handleSubmit}
    >
      <FormGroup controlId="import-from-url">
        <ControlLabel>{t('url_to_fetch_the_file_from')}</ControlLabel>

        <FormControl
          type="url"
          placeholder="https://example.com/my-file.png"
          required
          value={url}
          onChange={handleChange}
        />
      </FormGroup>

      <FileTreeCreateNameInput
        label={t('file_name_in_this_project')}
        placeholder="my_file"
        error={error}
      />

      {error && <ErrorMessage error={error} />}
    </form>
  )
}
