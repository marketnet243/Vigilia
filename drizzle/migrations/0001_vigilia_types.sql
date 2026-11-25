DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='app_role' AND typnamespace='public'::regnamespace) THEN CREATE TYPE public.app_role AS ENUM ('owner','admin'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='app_env' AND typnamespace='public'::regnamespace) THEN CREATE TYPE public.app_env AS ENUM ('production','staging','development'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='incident_severity' AND typnamespace='public'::regnamespace) THEN CREATE TYPE public.incident_severity AS ENUM ('low','medium','high','critical'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='incident_status' AND typnamespace='public'::regnamespace) THEN CREATE TYPE public.incident_status AS ENUM ('open','in_progress','resolved'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='mission_priority' AND typnamespace='public'::regnamespace) THEN CREATE TYPE public.mission_priority AS ENUM ('low','medium','high','critical'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='mission_status' AND typnamespace='public'::regnamespace) THEN CREATE TYPE public.mission_status AS ENUM ('pending','planning','investigating','in_progress','awaiting_approval','validating','completed','failed','cancelled'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='step_status' AND typnamespace='public'::regnamespace) THEN CREATE TYPE public.step_status AS ENUM ('pending','running','awaiting_approval','completed','failed','skipped'); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='approval_status' AND typnamespace='public'::regnamespace) THEN CREATE TYPE public.approval_status AS ENUM ('pending','approved','rejected','expired','executed'); END IF;
END $$;