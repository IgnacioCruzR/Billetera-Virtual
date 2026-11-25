import { createContext, useContext } from 'react'
import { filterCategories, seedCategories, type CategoryType } from './category-model'

export const CategoryContext = createContext(seedCategories)
export const useCategoryCatalog = () => useContext(CategoryContext)
export function useCategories(type?: CategoryType, activeOnly = false, retainedId?: string) {
  return filterCategories(useCategoryCatalog(), type, activeOnly, retainedId)
}
export function useCategoryName() {
  const categories = useCategoryCatalog()
  return (id: string) => categories.find(item => item.id === id)?.name ?? id
}
