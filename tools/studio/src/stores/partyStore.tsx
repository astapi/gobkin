import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { parseBackupFile } from '../lib/backup'
import {
  EMPTY_LIBRARY,
  backupToLibrary,
  buildLibraryView,
  extractBackup,
  isCharacterLibraryShape,
  type BackupGoblin,
  type BackupParty,
  type CharacterLibrary,
  type CharacterLibraryView,
} from '../lib/goblinMapper'

export const MAX_PARTY_MEMBERS = 6
const PRESET_API_URL = '/api/party-presets'
const LIBRARY_API_URL = '/api/character-library'
const LEGACY_STORAGE_KEY = 'goblin-studio:party-presets:v1'

export interface PartyPreset {
  id: string
  name: string
  memberIds: number[]
  createdAt: string
  updatedAt: string
}

export interface PartyDraft {
  name: string
  members: (number | null)[]
}

interface PartyStoreValue {
  library: CharacterLibraryView
  libraryLoading: boolean
  libraryError: string | null
  importBackup: (file: File) => Promise<void>
  importBackupBusy: boolean
  importBackupError: string | null
  clearLibrary: () => Promise<void>

  draft: PartyDraft
  setDraftName: (name: string) => void
  setMemberAt: (index: number, goblinId: number | null) => void
  addMember: (goblinId: number) => boolean
  removeMember: (index: number) => void
  clearDraft: () => void

  loadLibraryParty: (partyId: number) => void
  importLibraryPartyAsPreset: (partyId: number) => PartyPreset | null

  upsertCharacter: (goblin: BackupGoblin) => Promise<void>
  removeCharacter: (id: number) => Promise<void>

  presets: PartyPreset[]
  presetsLoading: boolean
  presetsError: string | null
  savePreset: () => PartyPreset | null
  updatePreset: (id: string) => void
  loadPreset: (id: string) => void
  deletePreset: (id: string) => void
  renamePreset: (id: string, name: string) => void
}

const StoreContext = createContext<PartyStoreValue | null>(null)

const EMPTY_DRAFT: PartyDraft = {
  name: '新規PT',
  members: Array.from({ length: MAX_PARTY_MEMBERS }, () => null),
}

export function PartyStoreProvider({ children }: { children: ReactNode }) {
  const [library, setLibrary] = useState<CharacterLibrary>(EMPTY_LIBRARY)
  const [libraryLoading, setLibraryLoading] = useState(true)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const [importBackupBusy, setImportBackupBusy] = useState(false)
  const [importBackupError, setImportBackupError] = useState<string | null>(null)
  const [draft, setDraft] = useState<PartyDraft>(EMPTY_DRAFT)
  const [presets, setPresets] = useState<PartyPreset[]>([])
  const [presetsLoading, setPresetsLoading] = useState(true)
  const [presetsError, setPresetsError] = useState<string | null>(null)
  const presetsLoadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const fromServer = await fetchLibrary()
        if (cancelled) return
        setLibrary(fromServer)
      } catch (err) {
        if (!cancelled) {
          setLibraryError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) setLibraryLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const fromServer = await fetchPresets()
        if (cancelled) return
        const legacy = consumeLegacyLocalStorage()
        if (legacy.length > 0 && fromServer.length === 0) {
          await persistPresets(legacy)
          setPresets(legacy)
        } else {
          setPresets(fromServer)
        }
      } catch (err) {
        if (!cancelled) {
          setPresetsError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) {
          setPresetsLoading(false)
          presetsLoadedRef.current = true
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!presetsLoadedRef.current) return
    let cancelled = false
    ;(async () => {
      try {
        await persistPresets(presets)
        if (!cancelled) setPresetsError(null)
      } catch (err) {
        if (!cancelled) {
          setPresetsError(err instanceof Error ? err.message : String(err))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [presets])

  const libraryView = useMemo(() => buildLibraryView(library), [library])

  const importBackup = useCallback(async (file: File) => {
    setImportBackupBusy(true)
    setImportBackupError(null)
    try {
      const doc = await parseBackupFile(file)
      const extract = extractBackup(doc)
      const next = backupToLibrary(extract)
      await persistLibrary(next)
      setLibrary(next)
      setLibraryError(null)
    } catch (err) {
      setImportBackupError(err instanceof Error ? err.message : String(err))
    } finally {
      setImportBackupBusy(false)
    }
  }, [])

  const clearLibrary = useCallback(async () => {
    try {
      await deleteLibrary()
      setLibrary(EMPTY_LIBRARY)
      setLibraryError(null)
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const setDraftName = useCallback((name: string) => {
    setDraft((prev) => ({ ...prev, name }))
  }, [])

  const setMemberAt = useCallback((index: number, goblinId: number | null) => {
    setDraft((prev) => {
      if (index < 0 || index >= MAX_PARTY_MEMBERS) return prev
      const nextMembers = prev.members.slice()
      nextMembers[index] = goblinId
      return { ...prev, members: nextMembers }
    })
  }, [])

  const addMember = useCallback((goblinId: number): boolean => {
    let added = false
    setDraft((prev) => {
      if (prev.members.includes(goblinId)) return prev
      const emptyIdx = prev.members.findIndex((m) => m === null)
      if (emptyIdx < 0) return prev
      const nextMembers = prev.members.slice()
      nextMembers[emptyIdx] = goblinId
      added = true
      return { ...prev, members: nextMembers }
    })
    return added
  }, [])

  const removeMember = useCallback((index: number) => {
    setDraft((prev) => {
      if (index < 0 || index >= MAX_PARTY_MEMBERS) return prev
      const nextMembers = prev.members.slice()
      nextMembers[index] = null
      return { ...prev, members: nextMembers }
    })
  }, [])

  const clearDraft = useCallback(() => {
    setDraft({ ...EMPTY_DRAFT, members: EMPTY_DRAFT.members.slice() })
  }, [])

  const loadLibraryParty = useCallback(
    (partyId: number) => {
      const party = library.parties.find((p) => p.id === partyId)
      if (!party) return
      setDraft({
        name: party.name,
        members: Array.from(
          { length: MAX_PARTY_MEMBERS },
          (_, i) => party.memberIds[i] ?? null,
        ),
      })
    },
    [library],
  )

  const upsertCharacter = useCallback(async (goblin: BackupGoblin) => {
    let next: CharacterLibrary | null = null
    setLibrary((prev) => {
      const existingIndex = prev.goblins.findIndex((g) => g.id === goblin.id)
      const goblins =
        existingIndex >= 0
          ? prev.goblins.map((g, i) => (i === existingIndex ? goblin : g))
          : [...prev.goblins, goblin]
      const meta = prev.meta ?? { importedAt: new Date().toISOString() }
      next = { ...prev, goblins, meta }
      return next
    })
    if (next) {
      try {
        await persistLibrary(next)
        setLibraryError(null)
      } catch (err) {
        setLibraryError(err instanceof Error ? err.message : String(err))
      }
    }
  }, [])

  const removeCharacter = useCallback(async (id: number) => {
    let next: CharacterLibrary | null = null
    setLibrary((prev) => {
      const goblins = prev.goblins.filter((g) => g.id !== id)
      const equipment = prev.equipment.filter((e) => e.goblinId !== id)
      const parties = prev.parties.map((p) => ({
        ...p,
        memberIds: p.memberIds.filter((mid) => mid !== id),
      }))
      next = { ...prev, goblins, equipment, parties }
      return next
    })
    setDraft((prev) => ({
      ...prev,
      members: prev.members.map((m) => (m === id ? null : m)),
    }))
    if (next) {
      try {
        await persistLibrary(next)
        setLibraryError(null)
      } catch (err) {
        setLibraryError(err instanceof Error ? err.message : String(err))
      }
    }
  }, [])

  const importLibraryPartyAsPreset = useCallback(
    (partyId: number): PartyPreset | null => {
      const party = library.parties.find((p) => p.id === partyId)
      if (!party) return null
      const now = new Date().toISOString()
      const preset: PartyPreset = {
        id: `preset_library_${party.id}_${Date.now()}`,
        name: party.name,
        memberIds: party.memberIds.slice(),
        createdAt: now,
        updatedAt: now,
      }
      setPresets((prev) => [preset, ...prev])
      return preset
    },
    [library],
  )

  const savePreset = useCallback((): PartyPreset | null => {
    const memberIds = draft.members.filter((m): m is number => m !== null)
    if (memberIds.length === 0) return null
    const now = new Date().toISOString()
    const preset: PartyPreset = {
      id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: draft.name.trim() === '' ? '無名PT' : draft.name,
      memberIds,
      createdAt: now,
      updatedAt: now,
    }
    setPresets((prev) => [preset, ...prev])
    return preset
  }, [draft])

  const updatePreset = useCallback(
    (id: string) => {
      const memberIds = draft.members.filter((m): m is number => m !== null)
      setPresets((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                name: draft.name.trim() === '' ? p.name : draft.name,
                memberIds,
                updatedAt: new Date().toISOString(),
              }
            : p,
        ),
      )
    },
    [draft],
  )

  const loadPreset = useCallback((id: string) => {
    setPresets((prev) => {
      const preset = prev.find((p) => p.id === id)
      if (!preset) return prev
      setDraft({
        name: preset.name,
        members: Array.from(
          { length: MAX_PARTY_MEMBERS },
          (_, i) => preset.memberIds[i] ?? null,
        ),
      })
      return prev
    })
  }, [])

  const deletePreset = useCallback((id: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const renamePreset = useCallback((id: string, name: string) => {
    setPresets((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, name, updatedAt: new Date().toISOString() } : p,
      ),
    )
  }, [])

  const value = useMemo<PartyStoreValue>(
    () => ({
      library: libraryView,
      libraryLoading,
      libraryError,
      importBackup,
      importBackupBusy,
      importBackupError,
      clearLibrary,
      draft,
      setDraftName,
      setMemberAt,
      addMember,
      removeMember,
      clearDraft,
      loadLibraryParty,
      importLibraryPartyAsPreset,
      upsertCharacter,
      removeCharacter,
      presets,
      presetsLoading,
      presetsError,
      savePreset,
      updatePreset,
      loadPreset,
      deletePreset,
      renamePreset,
    }),
    [
      libraryView,
      libraryLoading,
      libraryError,
      importBackup,
      importBackupBusy,
      importBackupError,
      clearLibrary,
      draft,
      setDraftName,
      setMemberAt,
      addMember,
      removeMember,
      clearDraft,
      loadLibraryParty,
      importLibraryPartyAsPreset,
      upsertCharacter,
      removeCharacter,
      presets,
      presetsLoading,
      presetsError,
      savePreset,
      updatePreset,
      loadPreset,
      deletePreset,
      renamePreset,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function usePartyStore(): PartyStoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('usePartyStore は PartyStoreProvider 内で使用してください')
  return ctx
}

export function useGoblinById(id: number | null | undefined): BackupGoblin | null {
  const { library } = usePartyStore()
  return useMemo(() => {
    if (id === null || id === undefined) return null
    return library.goblins.find((g) => g.id === id) ?? null
  }, [library, id])
}

export type { BackupParty }

async function fetchLibrary(): Promise<CharacterLibrary> {
  const res = await fetch(LIBRARY_API_URL)
  if (!res.ok) throw new Error(`キャラクター読み込み失敗: HTTP ${res.status}`)
  const data = (await res.json()) as unknown
  if (!isCharacterLibraryShape(data)) return EMPTY_LIBRARY
  return {
    goblins: data.goblins,
    equipment: data.equipment,
    parties: data.parties,
    meta: (data as { meta?: CharacterLibrary['meta'] }).meta ?? null,
  }
}

async function persistLibrary(library: CharacterLibrary): Promise<void> {
  const res = await fetch(LIBRARY_API_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(library),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error ?? `キャラクター保存失敗: HTTP ${res.status}`)
  }
}

async function deleteLibrary(): Promise<void> {
  const res = await fetch(LIBRARY_API_URL, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error ?? `キャラクター削除失敗: HTTP ${res.status}`)
  }
}

async function fetchPresets(): Promise<PartyPreset[]> {
  const res = await fetch(PRESET_API_URL)
  if (!res.ok) throw new Error(`プリセット読み込み失敗: HTTP ${res.status}`)
  const data = (await res.json()) as unknown
  if (!Array.isArray(data)) return []
  return data.filter(
    (p): p is PartyPreset =>
      typeof p === 'object' &&
      p !== null &&
      typeof (p as PartyPreset).id === 'string' &&
      typeof (p as PartyPreset).name === 'string' &&
      Array.isArray((p as PartyPreset).memberIds),
  )
}

async function persistPresets(presets: PartyPreset[]): Promise<void> {
  const res = await fetch(PRESET_API_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(presets),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.error ?? `プリセット保存失敗: HTTP ${res.status}`)
  }
}

function consumeLegacyLocalStorage(): PartyPreset[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PartyPreset[]
    const valid = Array.isArray(parsed)
      ? parsed.filter(
          (p): p is PartyPreset =>
            typeof p.id === 'string' &&
            typeof p.name === 'string' &&
            Array.isArray(p.memberIds),
        )
      : []
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    return valid
  } catch {
    return []
  }
}
