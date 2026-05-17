// Setup global da suite (vitest): habilita IndexedDB in-memory pros testes do PDV offline.

// fake-indexeddb: shim do IndexedDB para o ambiente Node (vitest).
// Importado globalmente porque módulos do PDV offline (Dexie) dependem
// do objeto `indexedDB`, que não existe no Node por padrão.
import 'fake-indexeddb/auto'

export {}
