-- ============================================================================
-- 0003_seed — pre-registered partner organizations
-- Admin onboards partners manually for MVP (we have the connections). Mirrors
-- the real Lisbon flow: embassy = VERIFIER, funeral homes = BENEFICIARY.
-- Idempotent: guarded by NOT EXISTS on (name, country).
-- ============================================================================

insert into organizations (name, type, country, contact_email, contact_phone, description, status, can_be_beneficiary, can_be_verifier)
select * from (values
  (
    'Embassy of Pakistan, Lisbon', 'embassy'::org_type, 'PT',
    'pareplisbon@mofa.gov.pk', '+351-21-300-9070',
    'Assists with local burial or repatriation of remains to Pakistan; issues NOC against death certificate and cancelled NADRA ID. Acts as a verifier.',
    'verified'::org_status, false, true
  ),
  (
    'Servilusa Agências Funerárias', 'funeral_home'::org_type, 'PT',
    'geral@servilusa.pt', '+351-21-754-2400',
    'Portuguese funeral agency handling transportation, permits, and Muslim burial requirements. Can receive funds directly.',
    'verified'::org_status, true, false
  ),
  (
    'Funerária Triunfo', 'funeral_home'::org_type, 'PT',
    'info@funerariatriunfo.pt', '+351-21-000-0000',
    'Local funeral director in Portugal handling repatriation logistics. Can receive funds directly.',
    'verified'::org_status, true, false
  )
) as v(name, type, country, contact_email, contact_phone, description, status, can_be_beneficiary, can_be_verifier)
where not exists (
  select 1 from organizations o where o.name = v.name and o.country = v.country
);
