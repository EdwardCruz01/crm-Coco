-- Reject incomplete API payloads: SQL CHECK otherwise accepts NULL.
BEGIN;
ALTER TABLE public.crm_records DROP CONSTRAINT crm_client_valid;
ALTER TABLE public.crm_records ADD CONSTRAINT crm_client_valid CHECK (
  kind <> 'clients' OR COALESCE(
    length(trim(payload->>'name')) > 0
    AND right(regexp_replace(payload->>'phone','\D','','g'),9) ~ '^9[0-9]{8}$'
    AND payload->>'stage' IN ('nuevo','contactado','potencial','calificado','visita_prog','visita_real','negociacion','reserva','cerrada','perdido')
    AND (COALESCE(payload->>'dni','') = '' OR payload->>'dni' ~ '^[0-9]{8}$'), false)
);
ALTER TABLE public.crm_records ADD CONSTRAINT crm_payload_id CHECK (
  kind IN ('templates','savedFilters') OR COALESCE(payload->>'id' = id, false)
);
COMMIT;
