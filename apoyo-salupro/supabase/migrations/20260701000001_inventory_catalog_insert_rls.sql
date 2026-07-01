-- Permite crear categorías/subcategorías del catálogo global desde el
-- combobox de inventario. La migración 20260630000001 solo definió políticas
-- de SELECT para inventory_sections/inventory_subcategories, por lo que los
-- POST /api/inventory/sections y /api/inventory/subcategories fallaban con
-- "new row violates row-level security policy".
--
-- Cualquier usuario autenticado con una asignación a un centro de acopio
-- puede crear (INSERT) categorías/subcategorías; siguen siendo catálogos
-- globales compartidos por todos los centros.

CREATE POLICY ins_sections ON inventory_sections
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM acopio_user_assignments WHERE user_id = auth.uid())
  );

CREATE POLICY ins_subcats ON inventory_subcategories
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM acopio_user_assignments WHERE user_id = auth.uid())
  );
