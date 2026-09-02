// Ambient module declaration for @uppy/utils subpath imports.
// Under Yarn PnP, TypeScript cannot find the ambient declarations in
// @uppy/utils/types/index.d.ts for deep imports like
// @uppy/utils/lib/getDroppedFiles. Re-declare the subset we use here.
declare module '@uppy/utils/lib/getDroppedFiles' {
  function getDroppedFiles(
    dataTransfer: DataTransfer,
    options?: Record<string, unknown>
  ): Promise<File[]>
  export default getDroppedFiles
}
