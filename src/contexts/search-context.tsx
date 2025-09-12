"use client"

import React, { createContext, useContext, useState, useCallback } from "react"
import { Spark } from "@/types/spark"

interface SearchContextType {
  filteredSparks: Spark[]
  setFilteredSparks: (sparks: Spark[]) => void
}

const SearchContext = createContext<SearchContextType | undefined>(undefined)

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [filteredSparks, setFilteredSparks] = useState<Spark[]>([])

  const value = {
    filteredSparks,
    setFilteredSparks: useCallback((sparks: Spark[]) => {
      console.log('[SearchContext] setFilteredSparks called:', {
        timestamp: new Date().toISOString(),
        sparksLength: sparks?.length || 0,
        sparks: sparks?.map(s => ({ id: s.id, title: s.title })) || []
      })
      setFilteredSparks(sparks)
    }, [])
  }

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  )
}

export function useSearch() {
  const context = useContext(SearchContext)
  if (context === undefined) {
    throw new Error("useSearch must be used within a SearchProvider")
  }
  return context
}