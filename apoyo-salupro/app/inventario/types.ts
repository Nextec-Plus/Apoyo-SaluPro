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

export type ItemStockLocation = {
  location_id: string
  location_name: string
  stock: number
}

export type ItemRow = InventoryItem & {
  subcategory: (InventorySubcategory & {
    section: InventorySection | null
  }) | null
  stock_locations: ItemStockLocation[]
}

export type MovementRow = InventoryMovement & {
  item: (Pick<InventoryItem, 'id' | 'presentacion' | 'stock'> & {
    subcategory: (Pick<InventorySubcategory, 'id' | 'name'> & {
      section: Pick<InventorySection, 'id' | 'name'> | null
    }) | null
  }) | null
  location: Pick<InventoryLocation, 'id' | 'name'> | null
}
