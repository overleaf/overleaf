import { useHistoryContext } from '../context/history-context'

function HistoryFileTree() {
  // eslint-disable-next-line no-unused-vars
  const { fileSelection, setFileSelection } = useHistoryContext()

  return fileSelection ? (
    <ol>
      {fileSelection.files.map(file => (
        <li key={file.pathname}>{file.pathname}</li>
      ))}
    </ol>
  ) : (
    <div>No files</div>
  )
}

export default HistoryFileTree
