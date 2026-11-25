-- =========================================================================
-- Script SQL d'activation immédiate du Propriétaire Vigilia
-- Compte : kayoyolandry@gmail.com
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_user_id uuid;
  v_email text := 'kayoyolandry@gmail.com';
  v_password text := 'Landry@2025';
  v_encrypted_pw text;
BEGIN
  v_encrypted_pw := crypt(v_password, gen_salt('bf'));

  -- 1. Vérifier si l'utilisateur existe déjà dans auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      v_email,
      v_encrypted_pw,
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now(),
      'authenticated',
      'authenticated'
    );

    -- Insérer dans auth.identities
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      v_user_id,
      format('{"sub":"%s","email":"%s"}', v_user_id, v_email)::jsonb,
      'email',
      v_email,
      now(),
      now(),
      now()
    );
  ELSE
    -- Mettre à jour le mot de passe et confirmer automatiquement l'email
    UPDATE auth.users
    SET 
      encrypted_password = v_encrypted_pw,
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      confirmed_at = COALESCE(confirmed_at, now()),
      updated_at = now()
    WHERE id = v_user_id;
  END IF;

  -- 2. Attribuer le rôle "owner" dans public.user_roles si la table existe
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'owner'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RAISE NOTICE 'Compte Propriétaire activé avec succès pour % (ID: %)', v_email, v_user_id;
END $$;
