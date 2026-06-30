import type {
  InventorySection,
  InventorySubcategory,
  InventoryLocation,
  InventoryItem,
  InventoryMovement,
} from '@/lib/types/database'

export type SectionWithSubcats = InventorySection & {
  subcategories: InventorySubcategory[]
}

export type ItemRow = InventoryItem & {
  subcategory: (InventorySubcategory & {
    section: InventorySection | null
  }) | null
  location: Pick<InventoryLocation, 'id' | 'name'> | null
}

export type MovementRow = InventoryMovement & {
  item: (Pick<InventoryItem, 'id' | 'presentacion' | 'stock'> & {
    subcategory: (Pick<InventorySubcategory, 'id' | 'name'> & {
      section: Pick<InventorySection, 'id' | 'name'> | null
    }) | null
  }) | null
}
