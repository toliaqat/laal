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

-- ------------------------------------------------- partner organisations ----
-- Verified funeral homes in each corridor city. The money for every demo
-- fundraiser goes to one of these — never to an individual — which is the
-- trust story the video tells. Fixed ids so the seed is idempotent.
insert into organizations (id, name, type, country, contact_email, description, status, can_be_beneficiary, can_be_verifier, stripe_onboarding_complete)
values
 ('a1000000-0000-4000-8000-000000000001','Al-Amanah Funeral Services, Berlin','funeral_home','DE','info@al-amanah.example','Muslim funeral home handling washing, janazah and repatriation of remains from Germany to Pakistan.','verified',true,false,true),
 ('a1000000-0000-4000-8000-000000000002','Crescent Funeral Services, London','funeral_home','GB','office@crescent-funerals.example','Repatriation of remains from the UK to Pakistan, including consular paperwork and airline cargo.','verified',true,false,true),
 ('a1000000-0000-4000-8000-000000000003','Northern Janazah Services, Manchester','funeral_home','GB','hello@northern-janazah.example','Community funeral service covering the North of England; repatriation to Pakistan.','verified',true,false,true),
 ('a1000000-0000-4000-8000-000000000004','Casa Funeraria Al-Salam, Milano','funeral_home','IT','info@al-salam.example','Islamic funeral services and international repatriation from Italy.','verified',true,false,true),
 ('a1000000-0000-4000-8000-000000000005','Bestattungen Al-Huda, München','funeral_home','DE','kontakt@al-huda.example','Islamic funeral home in Bavaria; repatriation to South Asia.','verified',true,false,true),
 ('a1000000-0000-4000-8000-000000000006','Uitvaart Al-Baraka, Amsterdam','funeral_home','NL','info@al-baraka.example','Islamic funeral care and repatriation from the Netherlands.','verified',true,false,true)
on conflict (id) do update set name = excluded.name, status = excluded.status,
  can_be_beneficiary = excluded.can_be_beneficiary, stripe_onboarding_complete = excluded.stripe_onboarding_complete;

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

Last week Amir collapsed at work and did not recover. His family''s one wish is to bring him home, so his mother can say goodbye and he can be buried beside his father.

This fundraiser pays for Amir''s repatriation to Lahore. Every euro goes directly to Al-Amanah Funeral Services in Berlin, the verified partner handling the washing, the embassy paperwork and the flight home. Nothing is paid to an individual.'),
 ('demo-khan-family','bilal-khan','Bilal Khan','1974-06-02','2026-08-21','London','United Kingdom','17 days','16 days','GBP',
  'Bilal Khan drove buses across London for fifteen years and greeted every passenger by name. He passed away suddenly, far from the village in Peshawar where he was born.

His family has asked for one thing: to bring him home. This fundraiser covers the repatriation of Bilal''s remains to Peshawar, paid directly to Crescent Funeral Services in London, our verified partner.'),
 ('demo-farewell-mariam','mariam-sayed','Mariam Sayed','1979-01-22','2026-08-25','Lisbon','Portugal','13 days','12 days','EUR',
  'Mariam Sayed spent twenty years caring for other people''s families as a nurse in Lisbon. She was gentle, patient, and endlessly kind.

Her family in Karachi wants to lay her to rest beside her parents. This fundraiser pays for Mariam''s repatriation, handled end to end by Servilusa, a verified partner funeral home in Lisbon, with the Embassy of Pakistan confirming the paperwork.'),
 ('demo-carry-yusuf-home','yusuf-ali','Yusuf Ali','2000-11-08','2026-08-30','Manchester','United Kingdom','8 days','7 days','GBP',
  'Yusuf was twenty-six. He worked on construction sites in Manchester and called his mother every single evening without fail. His mother''s one request is to hold her son one last time.

This fundraiser brings Yusuf home to Sialkot. The funds go directly to Northern Janazah Services in Manchester, the verified partner arranging the repatriation.'),
 ('demo-begum-children','fatima-begum','Fatima Begum','1977-05-30','2026-08-15','Milan','Italy','24 days','23 days','EUR',
  'Fatima Begum moved to Milan for work and sent everything she could to her four children in Multan. She passed away suddenly, and her children want to bury her at home, near them.

This fundraiser pays for Fatima''s repatriation to Multan through Casa Funeraria Al-Salam in Milan, a verified partner. No money passes through private hands.'),
 ('demo-farewell-rashid','rashid-iqbal','Rashid Iqbal','1962-09-19','2026-07-28','Munich','Germany','44 days','43 days','EUR',
  'Rashid Iqbal was a beloved imam and a quiet pillar of his community in Munich for over a decade. When he passed, the community he had cared for came together in return.

Within days the goal was reached and the funds were released to Bestattungen Al-Huda in Munich, who brought Rashid home to Rawalpindi with honour.'),
 ('demo-pending-noor','noor-begum','Noor Begum','1985-02-11','2026-09-06','Amsterdam','Netherlands','2 days',null,'EUR',
  'Noor was a devoted mother of three who worked in Amsterdam for many years. Her family has asked for help to bring her home to Karachi for burial.

The repatriation will be handled by Uitvaart Al-Baraka in Amsterdam, a verified partner; funds are released to them only after the need is verified.');

update campaigns c
   set cover_image_url = 'http://127.0.0.1:54321/storage/v1/object/public/laal-public/demo/' || s.portrait || '.jpg',
       deceased_name = s.name, deceased_dob = s.dob, deceased_dod = s.dod,
       death_city = s.city, death_country = s.country, currency = s.currency,
       deceased_nationality = 'Pakistani', story = s.story, intended_use = 'repatriation',
       repatriation_city = case s.slug when 'demo-bringing-amir-home' then 'Lahore' when 'demo-khan-family' then 'Peshawar' when 'demo-farewell-mariam' then 'Karachi' when 'demo-carry-yusuf-home' then 'Sialkot' when 'demo-begum-children' then 'Multan' when 'demo-farewell-rashid' then 'Rawalpindi' else 'Karachi' end,
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
select c.id, 'organization'::beneficiary_type, o.id, null::uuid, o.name, null::text, true
  from campaigns c
  join organizations o on o.id = case c.slug
    when 'demo-bringing-amir-home' then 'a1000000-0000-4000-8000-000000000001'::uuid
    when 'demo-khan-family'        then 'a1000000-0000-4000-8000-000000000002'::uuid
    when 'demo-carry-yusuf-home'   then 'a1000000-0000-4000-8000-000000000003'::uuid
    when 'demo-begum-children'     then 'a1000000-0000-4000-8000-000000000004'::uuid
    when 'demo-farewell-rashid'    then 'a1000000-0000-4000-8000-000000000005'::uuid
    when 'demo-pending-noor'       then 'a1000000-0000-4000-8000-000000000006'::uuid
    when 'demo-farewell-mariam'    then '0f9a1d8a-b2c8-420e-afb4-c9c2e68528b4'::uuid
  end
 where c.slug like 'demo-%';

-- ------------------------------------------------------------ verification ----
delete from verifications where campaign_id in (select id from campaigns where slug like 'demo-%');
insert into verifications (campaign_id, type, status, verifier_type, verifier_org_id, reviewed_by, reviewed_at, notes)
select c.id, 'death'::verification_type, 'approved'::verification_status, 'embassy'::verifier_type, '6d847e8c-1cb1-4eed-a1e0-18e499a31c38'::uuid,
       (select id from profiles where email = 'organizer@laal.demo')::uuid, c.published_at, 'Death certificate confirmed with the consular section.'
  from campaigns c where c.slug like 'demo-%' and c.published_at is not null
union all
select c.id, 'death'::verification_type, 'submitted'::verification_status, 'embassy'::verifier_type, '6d847e8c-1cb1-4eed-a1e0-18e499a31c38'::uuid, null::uuid, null::timestamptz, null::text
  from campaigns c where c.slug = 'demo-pending-noor';

-- ------------------------------------------------------ family updates ----
delete from campaign_updates where campaign_id in (select id from campaigns where slug like 'demo-%');
insert into campaign_updates (campaign_id, author_id, body, created_at)
select c.id, c.organizer_id,
       'Al-Amanah has confirmed the embassy NOC is issued and the flight to Lahore is booked for this Friday. Laal releases the funds to them directly, so the family has not had to handle a single payment. Thank you — every one of you has carried a piece of this.',
       now() - interval '2 days'
  from campaigns c where c.slug = 'demo-bringing-amir-home'
union all
select c.id, c.organizer_id,
       'Amir''s janazah prayer was held at the Wedding mosque this morning. His colleagues from the warehouse came in their uniforms. We are humbled.',
       now() - interval '5 days'
  from campaigns c where c.slug = 'demo-bringing-amir-home';

commit;
