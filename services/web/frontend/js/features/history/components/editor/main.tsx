import { useHistoryContext } from '../../context/history-context'

function Main() {
  const { fileSelection } = useHistoryContext()

  return <div>Main (editor). File: {fileSelection?.pathname || 'not set'}</div>
}

export default Main
