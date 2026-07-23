-- The app now offers only 'local_burial' and 'repatriation' as intended uses.
-- The enum keeps its legacy values ('family_support', 'mixed') because Postgres
-- cannot drop enum values in place, but no new rows should default to 'mixed'.
alter table campaigns alter column intended_use set default 'local_burial';
