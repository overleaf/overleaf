import { useState, useEffect } from 'react'

type ExternalScriptLoaderProps = {
  children: JSX.Element
  src: string
}

function ExternalScriptLoader({ children, src }: ExternalScriptLoaderProps) {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const body = document.querySelector('body')
    const script = document.createElement('script')

    script.async = true
    script.src = src
    script.onload = () => {
      setLoaded(true)
    }

    body?.appendChild(script)

    return () => {
      body?.removeChild(script)
    }
  }, [src])

  return loaded ? children : null
}

export default ExternalScriptLoader
