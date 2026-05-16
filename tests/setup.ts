// Reservado para mocks globais futuros (Supabase, etc).

// fake-indexeddb: shim do IndexedDB para o ambiente Node (vitest).
// Importado globalmente porque módulos do PDV offline (Dexie) dependem
// do objeto `indexedDB`, que não existe no Node por padrão.
import 'fake-indexeddb/auto'

export {}
