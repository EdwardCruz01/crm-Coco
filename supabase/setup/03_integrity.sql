-- Proyecto nuevo: integridad y duplicados también en el servidor.
create unique index crm_client_dni_unique on public.crm_records ((payload->>'dni')) where kind='clients' and coalesce(payload->>'dni','')<>'';
create unique index crm_client_email_unique on public.crm_records (lower(payload->>'email')) where kind='clients' and coalesce(payload->>'email','')<>'';
create unique index crm_client_phone_unique on public.crm_records ((right(regexp_replace(payload->>'phone','\D','','g'),9))) where kind='clients';
alter table public.crm_records add constraint crm_payload_object check(jsonb_typeof(payload)='object');
alter table public.crm_records add constraint crm_client_valid check(kind<>'clients' or (length(trim(payload->>'name'))>0 and right(regexp_replace(payload->>'phone','\D','','g'),9) ~ '^9[0-9]{8}$' and payload->>'stage' in ('nuevo','contactado','potencial','calificado','visita_prog','visita_real','negociacion','reserva','cerrada','perdido')));
