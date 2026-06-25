-- Migration 004: Fix catastrophe RLS — policies lacked INSERT WITH CHECK
-- and blocked writes when JWT has no organization_id claim.

DROP POLICY IF EXISTS "org_isolation_victims" ON catastrophe_victims;
DROP POLICY IF EXISTS "org_isolation_victim_info" ON catastrophe_victim_info;
DROP POLICY IF EXISTS "org_isolation_family_contacts" ON catastrophe_family_contacts;
DROP POLICY IF EXISTS "org_isolation_care_requirements" ON catastrophe_care_requirements;

-- Dashboard staff (authenticated via Supabase Auth)
CREATE POLICY "auth_all_victims" ON catastrophe_victims
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "auth_all_victim_info" ON catastrophe_victim_info
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "auth_all_family_contacts" ON catastrophe_family_contacts
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "auth_all_care_requirements" ON catastrophe_care_requirements
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
