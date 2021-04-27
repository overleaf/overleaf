import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import WordCountModalContent from './word-count-modal-content'
import { fetchWordCount } from '../utils/api'

function WordCountModal({ clsiServerId, handleHide, projectId, show }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState()

  useEffect(() => {
    if (!show) {
      return
    }

    setData(undefined)
    setError(false)
    setLoading(true)

    fetchWordCount(projectId, clsiServerId)
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
  }, [show, projectId, clsiServerId])

  return (
    <WordCountModalContent
      data={data}
      error={error}
      show={show}
      handleHide={handleHide}
      loading={loading}
    />
  )
}

WordCountModal.propTypes = {
  clsiServerId: PropTypes.string,
  handleHide: PropTypes.func.isRequired,
  projectId: PropTypes.string.isRequired,
  show: PropTypes.bool.isRequired,
}

export default WordCountModal
