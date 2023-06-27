type EntryContainerProps = {
  children: React.ReactNode
}

function EntryContainer({ children }: EntryContainerProps) {
  return <div className="rp-entry-wrapper">{children}</div>
}

export default EntryContainer
