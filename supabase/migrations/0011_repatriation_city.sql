-- For repatriation campaigns: the city in Pakistan the deceased will be
-- transported to for burial. Null for local-burial campaigns.
alter table campaigns add column repatriation_city text;
