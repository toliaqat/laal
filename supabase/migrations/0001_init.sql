-- ============================================================================
-- Laal — initial schema (0001_init)
-- Crowdfunding for expat bereavement: donors fund campaigns; funds are held in
-- the platform Stripe balance and released to a verified beneficiary (a partner
-- organization OR an individual) only after verification gates pass.
-- ============================================================================

-- ============ ENUMS ============
create type user_role           as enum ('donor','organizer','org_member','admin');
create type org_type            as enum ('embassy','funeral_home','charity','employer','community','religious');
create type org_status          as enum ('pending','verified','suspended');
create type campaign_status     as enum ('draft','pending_review','active','paused','completed','closed','rejected');
create type beneficiary_type    as enum ('organization','individual');
create type intended_use        as enum ('repatriation','local_burial','family_support','mixed');
create type verification_type   as enum ('death','relationship','identity');
create type verification_status as enum ('pending','submitted','approved','rejected');
create type verifier_type       as enum ('embassy','employer','funeral_home','admin','document');
create type document_type       as enum ('death_certificate','passport','national_id','noc','obituary','relationship_proof','other');
create type donation_status     as enum ('pending','succeeded','refunded','failed');
create type payout_status       as enum ('held','scheduled','in_transit','paid','failed','cancelled');

-- ============ PEOPLE & ORGS ============

-- extends Supabase auth.users
create table profiles (
  id           uuid primary key references auth.users(id),
  full_name    text,
  email        text,
  phone        text,
  country      text,
  avatar_url   text,
  role         user_role not null default 'donor',
  created_at   timestamptz not null default now()
);

-- verified partner organizations (embassies, funeral homes, charities, ...)
-- an org may be a money recipient, a verifier, or both.
create table organizations (
  id                         uuid primary key default gen_random_uuid(),
  name                       text not null,
  type                       org_type not null,
  country                    text not null,
  contact_email              text,
  contact_phone              text,
  description                text,
  logo_url                   text,
  status                     org_status not null default 'pending',
  can_be_beneficiary         boolean not null default false,
  can_be_verifier            boolean not null default false,
  stripe_connect_account_id  text,                          -- only if it receives money
  stripe_onboarding_complete boolean not null default false,
  created_by                 uuid references profiles(id),  -- admin who registered it
  created_at                 timestamptz not null default now()
);

-- staff who manage an org inside the app (post-MVP, but cheap to include)
create table organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  profile_id      uuid not null references profiles(id),
  org_role        text not null default 'staff',           -- 'admin' | 'staff'
  created_at      timestamptz not null default now(),
  unique (organization_id, profile_id)
);

-- ============ CAMPAIGNS ============

create table campaigns (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text unique not null,                -- shareable URL
  organizer_id         uuid not null references profiles(id),
  title                text not null,
  story                text,
  cover_image_url      text,
  -- the deceased
  deceased_name        text not null,
  deceased_dob         date,
  deceased_dod         date,                                -- date of death
  deceased_nationality text,
  death_country        text,
  death_city           text,
  intended_use         intended_use not null default 'mixed',
  -- money
  goal_amount          numeric(12,2) not null,
  currency             char(3) not null default 'EUR',
  amount_raised        numeric(12,2) not null default 0,    -- denormalized cache (see trigger)
  status               campaign_status not null default 'draft',
  created_at           timestamptz not null default now(),
  published_at         timestamptz,
  deadline             timestamptz
);

-- two-track beneficiary: org OR individual (exactly one, enforced by CHECK).
-- one active beneficiary per campaign (partial unique index below).
create table beneficiaries (
  id                         uuid primary key default gen_random_uuid(),
  campaign_id                uuid not null references campaigns(id),
  type                       beneficiary_type not null,
  organization_id            uuid references organizations(id),  -- if org
  individual_profile_id      uuid references profiles(id),       -- if individual
  display_name               text not null,                      -- "Family of Ahmed K." / org name
  relationship_to_deceased   text,                               -- individual only
  stripe_connect_account_id  text,                               -- money destination
  stripe_onboarding_complete boolean not null default false,
  is_active                  boolean not null default true,
  created_at                 timestamptz not null default now(),
  check (
    (type = 'organization' and organization_id is not null and individual_profile_id is null) or
    (type = 'individual'   and individual_profile_id is not null and organization_id is null)
  )
);

-- ============ VERIFICATION (decoupled from beneficiary) ============
-- verifier (e.g. embassy) confirms the death / relationship; it is NOT
-- necessarily the money recipient. Hence verifier_org_id != beneficiary org.
create table verifications (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references campaigns(id),
  type            verification_type not null,            -- death | relationship | identity
  status          verification_status not null default 'pending',
  verifier_type   verifier_type not null,                -- embassy | employer | funeral_home | admin | document
  verifier_org_id uuid references organizations(id),     -- e.g. the embassy
  reviewed_by     uuid references profiles(id),          -- admin/staff who decided
  notes           text,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);

create table documents (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references campaigns(id),
  verification_id uuid references verifications(id),      -- which check this supports
  uploaded_by     uuid references profiles(id),
  type            document_type not null,                 -- death_certificate, noc, passport...
  storage_path    text not null,                          -- Supabase Storage key (private bucket)
  status          verification_status not null default 'submitted',
  created_at      timestamptz not null default now()
);

-- ============ MONEY ============

create table donations (
  id                       uuid primary key default gen_random_uuid(),
  campaign_id              uuid not null references campaigns(id),
  donor_profile_id         uuid references profiles(id),  -- null = guest
  donor_name               text,
  donor_email              text,
  amount                   numeric(12,2) not null,
  currency                 char(3) not null,
  platform_fee             numeric(12,2) not null default 0,
  net_amount               numeric(12,2) not null,
  is_anonymous             boolean not null default false,
  message                  text,                          -- condolence note
  stripe_payment_intent_id text unique,
  status                   donation_status not null default 'pending',
  created_at               timestamptz not null default now()
);

-- transfers/releases to the beneficiary's connected account
create table payouts (
  id                 uuid primary key default gen_random_uuid(),
  campaign_id        uuid not null references campaigns(id),
  beneficiary_id     uuid not null references beneficiaries(id),
  amount             numeric(12,2) not null,
  currency           char(3) not null,
  stripe_transfer_id text,                               -- platform balance -> connected acct
  stripe_payout_id   text,                               -- connected acct -> their bank
  status             payout_status not null default 'held',
  released_by        uuid references profiles(id),       -- admin who released
  released_at        timestamptz,
  created_at         timestamptz not null default now()
);

-- ============ COMMS & ENGAGEMENT ============

create table campaign_updates (        -- organizer posts updates to donors
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id),
  author_id   uuid references profiles(id),
  body        text not null,
  created_at  timestamptz not null default now()
);

create table communications (          -- outbound email/sms/push log
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id),
  profile_id  uuid references profiles(id),  -- recipient (null = guest by email)
  to_email    text,
  channel     text not null,                 -- 'email' | 'sms' | 'push'
  template    text not null,                 -- 'donation_receipt' | 'payout_released' | ...
  payload     jsonb,
  status      text not null default 'queued',-- 'queued' | 'sent' | 'failed'
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- immutable trail for money + verification actions (trust & compliance)
create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references profiles(id),
  action      text not null,        -- 'verification.approved', 'payout.released', ...
  entity_type text not null,
  entity_id   uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- ============ INDEXES ============
create unique index one_active_beneficiary on beneficiaries(campaign_id) where is_active;

create index idx_campaigns_status            on campaigns(status);
create index idx_campaigns_organizer         on campaigns(organizer_id);

create index idx_org_members_org             on organization_members(organization_id);
create index idx_org_members_profile         on organization_members(profile_id);

create index idx_beneficiaries_campaign      on beneficiaries(campaign_id);
create index idx_beneficiaries_org           on beneficiaries(organization_id);

create index idx_verifications_campaign      on verifications(campaign_id);
create index idx_verifications_org           on verifications(verifier_org_id);

create index idx_documents_campaign          on documents(campaign_id);
create index idx_documents_verification      on documents(verification_id);

create index idx_donations_campaign          on donations(campaign_id);
create index idx_donations_donor             on donations(donor_profile_id);

create index idx_payouts_campaign            on payouts(campaign_id);
create index idx_payouts_beneficiary         on payouts(beneficiary_id);

create index idx_campaign_updates_campaign   on campaign_updates(campaign_id);
create index idx_communications_campaign     on communications(campaign_id);
create index idx_audit_log_entity            on audit_log(entity_type, entity_id);

-- ============ amount_raised SYNC TRIGGER ============
-- Keep campaigns.amount_raised in step with successful donations. We react to
-- the transition INTO / OUT OF 'succeeded' so re-runs and refunds stay correct.
create or replace function sync_campaign_amount_raised()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    if new.status = 'succeeded' then
      update campaigns set amount_raised = amount_raised + new.amount
        where id = new.campaign_id;
    end if;

  elsif (tg_op = 'UPDATE') then
    -- became succeeded
    if new.status = 'succeeded' and old.status is distinct from 'succeeded' then
      update campaigns set amount_raised = amount_raised + new.amount
        where id = new.campaign_id;
    -- was succeeded, now reversed (e.g. refunded)
    elsif old.status = 'succeeded' and new.status is distinct from 'succeeded' then
      update campaigns set amount_raised = amount_raised - old.amount
        where id = new.campaign_id;
    end if;

  elsif (tg_op = 'DELETE') then
    if old.status = 'succeeded' then
      update campaigns set amount_raised = amount_raised - old.amount
        where id = old.campaign_id;
    end if;
    return old;
  end if;

  return new;
end;
$$;

create trigger trg_sync_amount_raised
  after insert or update or delete on donations
  for each row execute function sync_campaign_amount_raised();

-- ============================================================================
-- TODO: Row Level Security policies (deferred — see ARCHITECTURE.md)
-- ----------------------------------------------------------------------------
-- We enable RLS now so nothing is accidentally world-readable/writable before
-- launch, but defer the actual policies. With RLS enabled and no policies, only
-- the service-role key bypasses RLS — so the app backend still works while the
-- public anon key is locked out until policies are authored.
--
-- Intended policy shape per table (to be implemented before public launch):
--   profiles       : a user may read/update only their own row; admins read all.
--   organizations  : public may read status='verified'; only admins write.
--   campaigns      : public may read status in ('active','completed','closed');
--                    organizer may read/update OWN campaigns while in
--                    ('draft','pending_review'); admins full access.
--   beneficiaries  : organizer reads own campaign's beneficiary; writes limited
--                    pre-activation; admins full access.
--   verifications  : organizer reads own campaign's verifications (status only);
--                    ONLY admins/verifier-staff may approve/reject; no public.
--   documents      : organizer reads/uploads own campaign docs; admins read all;
--                    NEVER public (private storage bucket + signed URLs).
--   donations      : donor reads OWN donations; organizer reads aggregate of own
--                    campaign (consider a view, not raw rows); inserts via backend
--                    only; no public select of donor PII.
--   payouts        : NO public/organizer write or read of money movement; only
--                    admins/service-role. This is the money-movement boundary.
-- ============================================================================
alter table profiles      enable row level security;
alter table organizations enable row level security;
alter table campaigns     enable row level security;
alter table beneficiaries enable row level security;
alter table verifications enable row level security;
alter table documents     enable row level security;
alter table donations     enable row level security;
alter table payouts       enable row level security;
