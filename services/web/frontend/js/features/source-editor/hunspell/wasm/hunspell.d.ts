/* eslint no-dupe-class-members: 0 */

declare class Hunspell {
  cwrap(
    method: 'Hunspell_create',
    output: string,
    input: string[]
  ): (affPtr: number, dicPtr: number) => number

  cwrap(
    method: 'Hunspell_destroy',
    output: string,
    input: string[]
  ): (spellPtr: number) => number

  cwrap(
    method: 'Hunspell_spell',
    output: string,
    input: string[]
  ): (spellPtr: number, wordPtr: number) => number

  cwrap(
    method: 'Hunspell_suggest',
    output: string,
    input: string[]
  ): (spellPtr: number, suggestionListPtr: number, wordPtr: number) => number

  cwrap(
    method: 'Hunspell_add',
    output: string,
    input: string[]
  ): (spellPtr: number, wordPtr: number) => number

  cwrap(
    method: 'Hunspell_remove',
    output: string,
    input: string[]
  ): (spellPtr: number, wordPtr: number) => number

  cwrap(
    method: 'Hunspell_free_list',
    output: string,
    input: string[]
  ): (spellPtr: number, suggestionListPtr: number, n: number) => number

  stringToNewUTF8(input: string): number
  UTF8ToString(input: number): string
  _malloc(length: number): number
  _free(ptr: number): void
  getValue(ptr: number, type: string): number
  FS: {
    mkdir(path: string): void
    mount(type: any, opts: Record<string, any>, dir: string): void
    writeFile(
      path: string,
      data: string | ArrayBufferView,
      opts?: { flags?: string }
    )
  }

  MEMFS: any
}

declare const factory = async (options?: Record<string, any>) =>
  new Hunspell(options)

export default factory
