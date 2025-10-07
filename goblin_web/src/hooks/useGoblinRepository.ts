import { useState, useMemo } from 'react'
import { JsonGoblinRepositoryImpl } from '../repositories/JsonGoblinRepositoryImpl'
import { FirestoreGoblinRepositoryAdapter } from '../repositories/FirestoreGoblinRepositoryImpl'
import type { GoblinRepository } from '../repositories/GoblinRepository'

export function useGoblinRepository() {
  const [repositoryInitialized, setRepositoryInitialized] = useState(false)

  const useFirestore = import.meta.env.VITE_USE_FIRESTORE === 'true'

  const goblinRepository = useMemo(() => {
    const repo: GoblinRepository = useFirestore
      ? new FirestoreGoblinRepositoryAdapter()
      : new JsonGoblinRepositoryImpl()

    if (useFirestore && repo instanceof FirestoreGoblinRepositoryAdapter) {
      repo.setOnDataChange(() => {
        setRepositoryInitialized(true)
      })
    } else {
      setRepositoryInitialized(true)
    }

    return repo
  }, [useFirestore])

  return {
    goblinRepository,
    repositoryInitialized,
    isLoading: useFirestore && !repositoryInitialized
  }
}
