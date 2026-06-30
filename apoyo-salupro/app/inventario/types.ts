import type {
  InventoryCategory,
  InventoryLocation,
  InventoryMaterialAssignmentStatus,
  InventoryAssignment,
} from "@/lib/types/database";

/** Categoría con el nombre de su localización embebido (tal como la devuelve la API). */
export type CategoryWithLocation = InventoryCategory & {
  location: Pick<InventoryLocation, "id" | "name"> | null;
};

/** Fila de material con su estado de stock (vista inventory_materials_assignment_status). */
export type MaterialRow = InventoryMaterialAssignmentStatus;

/** Despacho con material y centro médico embebidos. */
export type AssignmentRow = InventoryAssignment & {
  material: { id: string; name: string; unit: string | null } | null;
  center: { id: string; name: string } | null;
};
