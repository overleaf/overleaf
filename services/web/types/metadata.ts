type Package = {
  caption: string
  meta: string
  score: number
  snippet: string
}

export type Metadata = {
  state: {
    documents: Record<
      string,
      {
        labels: string[]
        packages: Record<string, Package[]>
      }
    >
  }
}
