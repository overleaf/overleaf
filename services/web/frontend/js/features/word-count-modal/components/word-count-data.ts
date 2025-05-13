export type ServerWordCountData = {
  encode: string
  textWords: number
  headWords: number
  outside: number
  headers: number
  elements: number
  mathInline: number
  mathDisplay: number
  errors: number
  messages: string
}

export type WordCountData = ServerWordCountData & {
  textCharacters: number
  headCharacters: number
  captionWords: number
  captionCharacters: number
  footnoteWords: number
  footnoteCharacters: number
  abstractWords: number
  abstractCharacters: number
  otherWords: number
  otherCharacters: number
}
