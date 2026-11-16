/**
 * Errores al descargar una parte de la app (import dinámico). Pasan sin señal o
 * cuando dentro se actualizó y el navegador pide un archivo que ya no existe.
 * Mensajes de Chrome/Edge, Safari y Firefox. Origen: core-base (Realt-In).
 */
export function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '')
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk [\w-]+ failed|Unable to preload CSS/i.test(msg)
}
