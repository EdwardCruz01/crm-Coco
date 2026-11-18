-- Solo para un proyecto nuevo; no incluye datos ficticios.
CREATE TYPE public.app_role AS ENUM ('admin','asesor');
CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, display_name text NOT NULL DEFAULT '', avatar_path text NOT NULL DEFAULT '');
GRANT SELECT, UPDATE ON public.profiles TO authenticated; GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role public.app_role NOT NULL, UNIQUE(user_id));
GRANT SELECT ON public.user_roles TO authenticated; GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
CREATE POLICY roles_read ON public.user_roles FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'asesor'));
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
CREATE FUNCTION public.create_coco_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO public.profiles(id,display_name) VALUES(NEW.id,COALESCE(NEW.raw_user_meta_data->>'display_name',NEW.raw_user_meta_data->>'full_name','Usuario COCO')); RETURN NEW; END $$;
CREATE TRIGGER coco_profile_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_coco_profile();
CREATE TABLE public.crm_records (id text NOT NULL, kind text NOT NULL CHECK(kind IN ('clients','visits','projects','advisors','followUps','savedFilters','templates','verifications')), payload jsonb NOT NULL, PRIMARY KEY(kind,id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_records TO authenticated; GRANT ALL ON public.crm_records TO service_role;
ALTER TABLE public.crm_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY records_read ON public.crm_records FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'asesor') AND kind IN ('clients','visits','projects','advisors','verifications','savedFilters','templates')));
CREATE POLICY records_insert ON public.crm_records FOR INSERT TO authenticated WITH CHECK(public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'asesor') AND kind IN ('clients','visits','verifications','savedFilters')));
CREATE POLICY records_update ON public.crm_records FOR UPDATE TO authenticated USING(public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'asesor') AND kind IN ('clients','visits','verifications','savedFilters'))) WITH CHECK(public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'asesor') AND kind IN ('clients','visits','verifications','savedFilters')));
CREATE POLICY records_delete ON public.crm_records FOR DELETE TO authenticated USING(public.has_role(auth.uid(),'admin') OR (public.has_role(auth.uid(),'asesor') AND kind IN ('clients','visits','verifications','savedFilters')));
CREATE POLICY avatars_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='coco-profiles' AND (auth.uid()::text=(storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'asesor')));
CREATE POLICY avatars_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='coco-profiles' AND auth.uid()::text=(storage.foldername(name))[1]);
CREATE POLICY avatars_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='coco-profiles' AND auth.uid()::text=(storage.foldername(name))[1]);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.create_coco_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_coco_profile() TO service_role;