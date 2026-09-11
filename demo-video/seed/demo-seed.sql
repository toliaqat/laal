-- Laal demo-video seed — LOCAL SUPABASE ONLY (run via seed.sh).
-- Idempotent: re-running restores the exact starting state for a recording.
--
-- The cast (every face is AI-generated — nobody real is shown as deceased):
--   amir-hussain   Amir Hussain, 38, Berlin  → repatriation to Lahore  (the fundraiser we support on camera)
--   bilal-khan     Bilal Khan, 52, London    → family support
--   mariam-sayed   Mariam Sayed, 47, Lisbon  → local burial (funeral-home beneficiary)
--   yusuf-ali      Yusuf Ali, 26, Manchester → repatriation
--   fatima-begum   Fatima Begum, 49, Milan   → family support
--   rashid-iqbal   Rashid Iqbal, 64, Munich  → completed (goal reached)
--   noor-begum     Noor Begum, 41, Amsterdam → pending review (what the admin queue shows)
--   ahmed-raza     (created live on camera by the organizer persona)
\set ON_ERROR_STOP on
begin;

-- ---------------------------------------------------------------- safety ----
-- Every campaign in this database must be a demo one (or one the on-camera
-- organizer created during a previous take). Anything else = wrong database.
delete from donations      where campaign_id in (select id from campaigns where organizer_id = (select id from profiles where email = 'hamza@laal.demo') and slug not like 'demo-%');
delete from verifications  where campaign_id in (select id from campaigns where organizer_id = (select id from profiles where email = 'hamza@laal.demo') and slug not like 'demo-%');
delete from beneficiaries  where campaign_id in (select id from campaigns where organizer_id = (select id from profiles where email = 'hamza@laal.demo') and slug not like 'demo-%');
delete from documents      where campaign_id in (select id from campaigns where organizer_id = (select id from profiles where email = 'hamza@laal.demo') and slug not like 'demo-%');
delete from campaign_updates where campaign_id in (select id from campaigns where organizer_id = (select id from profiles where email = 'hamza@laal.demo') and slug not like 'demo-%');
delete from campaign_follows where campaign_id in (select id from campaigns where organizer_id = (select id from profiles where email = 'hamza@laal.demo') and slug not like 'demo-%');
delete from campaigns where organizer_id = (select id from profiles where email = 'hamza@laal.demo') and slug not like 'demo-%';
do $$ begin
  if exists (select 1 from campaigns where slug not like 'demo-%') then
    raise exception 'Refusing to seed: this database holds non-demo campaigns';
  end if;
end $$;

-- ------------------------------------------------------------- grants ----
-- Local-stack quirk: several tables here (beneficiaries, donations,
-- campaign_updates, ...) had lost the default Supabase table privileges for
-- anon/authenticated/service_role, so public campaign reads failed with 42501
-- (the campaigns_select_org_member policy subqueries beneficiaries) and the
-- service-role loaders returned nothing. Restore the platform defaults; RLS
-- still decides what anon/authenticated actually see.
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- Donations recorded by a real test-mode Stripe payment during a previous
-- take (the seeded supporter wall has no payment intent ids).
delete from donations where stripe_payment_intent_id is not null;

-- ---------------------------------------------------------------- people ----
-- One shared demo password for every *@laal.demo account (see README).
update auth.users
   set encrypted_password = extensions.crypt('LaalDemo2026', extensions.gen_salt('bf')),
       email_confirmed_at = coalesce(email_confirmed_at, now())
 where email like '%@laal.demo';

update profiles set full_name = 'Ayesha Rahman', role = 'admin'     where email = 'organizer@laal.demo';
update profiles set full_name = 'Hamza Hussain', role = 'organizer' where email = 'hamza@laal.demo';
update profiles set full_name = 'Sara Malik',    role = 'donor'     where email = 'sara@laal.demo';

-- ------------------------------------------------------------ fundraisers ----
-- Hamza (the on-camera organizer) is Amir's brother and runs that fundraiser.
update campaigns set organizer_id = (select id from profiles where email = 'hamza@laal.demo')
 where slug = 'demo-bringing-amir-home';
-- Portraits live in the local public bucket (uploaded by seed.sh).
create temp table seed_c (slug text, portrait text, name text, dob date, dod date, city text, country text,
                          created interval, published interval, currency text, story text) on commit drop;
insert into seed_c values
 ('demo-bringing-amir-home','amir-hussain','Amir Hussain','1988-03-14','2026-08-29','Berlin','Germany','9 days','8 days','EUR',
  'Amir came to Berlin eight years ago with a quiet dream: to build a better life for his wife Sana and their two small children back in Lahore. He worked double shifts at a logistics warehouse and never missed a call home.

Last week Amir collapsed at work and did not recover. His family''s only wish is to bring him home so his mother can say goodbye and he can be buried beside his father.

The cost of repatriation — the embassy paperwork, the funeral home in Berlin, and the flight to Lahore — is far beyond what the family can carry alone. Every contribution, large or small, brings Amir closer to home.'),
 ('demo-khan-family','bilal-khan','Bilal Khan','1974-06-02','2026-08-21','London','United Kingdom','17 days','16 days','GBP',
  'Bilal Khan was the heart of his family — a father of three who drove buses across London for fifteen years and greeted every passenger by name. He passed away suddenly, leaving his wife Ayesha and their children without their only income. This fundraiser will cover the funeral and give the family breathing room while they find their feet.'),
 ('demo-farewell-mariam','mariam-sayed','Mariam Sayed','1979-01-22','2026-08-25','Lisbon','Portugal','13 days','12 days','EUR',
  'Mariam Sayed spent twenty years caring for other people''s families as a nurse in Lisbon. She was gentle, patient, and endlessly kind. Her family has asked for a dignified local burial, handled by a verified partner funeral home, so that the community she served can gather to say farewell.'),
 ('demo-carry-yusuf-home','yusuf-ali','Yusuf Ali','2000-11-08','2026-08-30','Manchester','United Kingdom','8 days','7 days','GBP',
  'Yusuf was twenty-six. He worked on construction sites in Manchester and called his mother every single evening without fail. His mother''s one request is to hold her son one last time. This fundraiser will bring Yusuf home to Sialkot for burial.'),
 ('demo-begum-children','fatima-begum','Fatima Begum','1977-05-30','2026-08-15','Milan','Italy','24 days','23 days','EUR',
  'Fatima Begum raised four children alone after moving to Milan for work. She passed away leaving them with no one to lean on. This fundraiser will cover her burial and support the children through the months ahead, with funds reaching her eldest son Hassan directly.'),
 ('demo-farewell-rashid','rashid-iqbal','Rashid Iqbal','1962-09-19','2026-07-28','Munich','Germany','44 days','43 days','EUR',
  'Rashid Iqbal was a beloved imam and a quiet pillar of his community in Munich for over a decade. When he fell ill, the community he had cared for came together in return. His funeral has been held with honor, and the remaining support went to his wife and grandchildren.'),
 ('demo-pending-noor','noor-begum','Noor Begum','1985-02-11','2026-09-06','Amsterdam','Netherlands','2 days',null,'EUR',
  'Noor was a devoted mother of three who worked in Amsterdam for many years. Her family has asked for help to give her a dignified farewell and to bring her home to Karachi.');

update campaigns c
   set cover_image_url = 'http://127.0.0.1:54321/storage/v1/object/public/laal-public/demo/' || s.portrait || '.jpg',
       deceased_name = s.name, deceased_dob = s.dob, deceased_dod = s.dod,
       death_city = s.city, death_country = s.country, currency = s.currency,
       deceased_nationality = 'Pakistani', story = s.story,
       created_at = now() - s.created,
       published_at = case when s.published is null then null else now() - s.published end,
       deadline = null
  from seed_c s where s.slug = c.slug;

-- Donations spread over the fundraiser's life so the supporter wall reads naturally.
update donations d
   set created_at = c.published_at + (random() * (now() - c.published_at))
  from campaigns c where c.id = d.campaign_id and c.published_at is not null;

-- ---------------------------------------------------- who gets the money ----
delete from beneficiaries where campaign_id in (select id from campaigns where slug like 'demo-%');
insert into beneficiaries (campaign_id, type, organization_id, individual_profile_id, display_name, relationship_to_deceased, stripe_onboarding_complete)
select c.id, 'individual'::beneficiary_type, null::uuid, c.organizer_id, 'Hamza Hussain', 'brother', true from campaigns c where slug = 'demo-bringing-amir-home'
union all select c.id, 'individual'::beneficiary_type, null::uuid, c.organizer_id, 'Ayesha Khan', 'wife', true from campaigns c where slug = 'demo-khan-family'
union all select c.id, 'organization'::beneficiary_type, '0f9a1d8a-b2c8-420e-afb4-c9c2e68528b4'::uuid, null::uuid, 'Servilusa Agências Funerárias', null, true from campaigns c where slug = 'demo-farewell-mariam'
union all select c.id, 'individual'::beneficiary_type, null::uuid, c.organizer_id, 'Zainab Ali', 'mother', true from campaigns c where slug = 'demo-carry-yusuf-home'
union all select c.id, 'individual'::beneficiary_type, null::uuid, c.organizer_id, 'Hassan Begum', 'son', true from campaigns c where slug = 'demo-begum-children'
union all select c.id, 'individual'::beneficiary_type, null::uuid, c.organizer_id, 'Saeeda Iqbal', 'wife', true from campaigns c where slug = 'demo-farewell-rashid'
union all select c.id, 'individual'::beneficiary_type, null::uuid, c.organizer_id, 'Tariq Malik', 'husband', false from campaigns c where slug = 'demo-pending-noor';

-- ------------------------------------------------------------ verification ----
delete from verifications where campaign_id in (select id from campaigns where slug like 'demo-%');
insert into verifications (campaign_id, type, status, verifier_type, verifier_org_id, reviewed_by, reviewed_at, notes)
select c.id, 'death'::verification_type, 'approved'::verification_status, 'embassy'::verifier_type, '6d847e8c-1cb1-4eed-a1e0-18e499a31c38'::uuid,
       (select id from profiles where email = 'organizer@laal.demo')::uuid, c.published_at, 'Death certificate confirmed with the consular section.'
  from campaigns c where c.slug like 'demo-%' and c.published_at is not null
union all
select c.id, 'relationship'::verification_type, 'approved'::verification_status, 'document'::verifier_type, null::uuid,
       (select id from profiles where email = 'organizer@laal.demo'), c.published_at, 'Family registration (FRC) matches the beneficiary.'
  from campaigns c where c.slug like 'demo-%' and c.published_at is not null
union all
select c.id, 'death'::verification_type, 'submitted'::verification_status, 'embassy'::verifier_type, '6d847e8c-1cb1-4eed-a1e0-18e499a31c38'::uuid, null::uuid, null::timestamptz, null::text
  from campaigns c where c.slug = 'demo-pending-noor'
union all
select c.id, 'relationship'::verification_type, 'pending'::verification_status, 'document'::verifier_type, null::uuid, null::uuid, null::timestamptz, null::text
  from campaigns c where c.slug = 'demo-pending-noor';

-- ------------------------------------------------------ family updates ----
delete from campaign_updates where campaign_id in (select id from campaigns where slug like 'demo-%');
insert into campaign_updates (campaign_id, author_id, body, created_at)
select c.id, c.organizer_id,
       'The embassy has issued the NOC and the funeral home has confirmed the paperwork. We are now booking the flight to Lahore for this Friday. Thank you — every one of you has carried a piece of this.',
       now() - interval '2 days'
  from campaigns c where c.slug = 'demo-bringing-amir-home'
union all
select c.id, c.organizer_id,
       'Amir''s janazah prayer was held at the Wedding mosque this morning. His colleagues from the warehouse came in their uniforms. We are humbled.',
       now() - interval '5 days'
  from campaigns c where c.slug = 'demo-bringing-amir-home';

commit;
