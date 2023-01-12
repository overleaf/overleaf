import useWaitForI18n from '../../../../shared/hooks/use-wait-for-i18n'

function Root() {
  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

  return <h2>React Subscription Success</h2>
}

export default Root
