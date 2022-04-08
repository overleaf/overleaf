type CellProps = {
  children: React.ReactNode
}

function Cell({ children }: CellProps) {
  return <div className="affiliations-table-cell">{children}</div>
}

export default Cell
