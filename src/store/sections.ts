import { create } from 'zustand'
import { GenerationProgress } from '../types'

interface SectionsStore {
  currentSection: string | null
  generationProgress: GenerationProgress
  
  // Section management
  setCurrentSection: (id: string | null) => void
  
  // Generation progress
  setGenerationProgress: (progress: GenerationProgress) => void
  resetGenerationProgress: () => void
}

export const useSectionsStore = create<SectionsStore>()((set) => ({
  currentSection: null,
  generationProgress: {
    current: 0,
    total: 0,
    status: 'idle'
  },

  setCurrentSection: (id: string | null) => {
    set({ currentSection: id })
  },

  setGenerationProgress: (progress: GenerationProgress) => {
    set({ generationProgress: progress })
  },

  resetGenerationProgress: () => {
    set({
      generationProgress: {
        current: 0,
        total: 0,
        status: 'idle'
      }
    })
  }
}))