import React, { useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import AbortController from 'abort-controller'
import WordCountModalContent from './word-count-modal-content'
import { fetchWordCount } from '../utils/api'

function WordCountModal({ clsiServerId, handleHide, projectId, show }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState()
  const [abortController, setAbortController] = useState(new AbortController())

  useEffect(() => {
    if (!show) {
      return
    }

    setData(undefined)
    setError(false)
    setLoading(true)

    const _abortController = new AbortController()
    setAbortController(_abortController)

    fetchWordCount(projectId, clsiServerId, {
      signal: _abortController.signal
    })
      .then(data => {
        setData(data.texcount)
      })
      .catch(error => {
        if (error.cause?.name !== 'AbortError') {
          setError(true)
        }
      })
      .finally(() => {
        setLoading(false)
      })

    return () => {
      _abortController.abort()
    }
  }, [show, projectId, clsiServerId])

  const abortAndHide = useCallback(() => {
    abortController.abort()
    handleHide()
  }, [abortController, handleHide])

  return (
    <WordCountModalContent
      data={data}
      error={error}
      show={show}
      handleHide={abortAndHide}
      loading={loading}
    />
  )
}

WordCountModal.propTypes = {
  clsiServerId: PropTypes.string,
  handleHide: PropTypes.func.isRequired,
  projectId: PropTypes.string.isRequired,
  show: PropTypes.bool.isRequired
}

export default WordCountModal
