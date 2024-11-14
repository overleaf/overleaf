import { useState } from 'react'

type Target = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

function useValidateField<T extends { target: Target }>() {
  const [isValid, setIsValid] = useState(true)

  const validate = (e: T) => {
    let isValid = e.target.checkValidity()

    if (e.target.required) {
      isValid = isValid && Boolean(e.target.value.trim().length)
    }

    setIsValid(isValid)
  }

  return { validate, isValid }
}

export default useValidateField
