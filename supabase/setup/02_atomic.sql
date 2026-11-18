-- SECURITY INVOKER conserva RLS; todo el lote se confirma o se revierte.
create or replace function public.apply_crm_changes(changes jsonb) returns void
language plpgsql security invoker set search_path=public as $$
declare change jsonb;
begin
 if auth.uid() is null then raise exception 'No autenticado'; end if;
 if jsonb_typeof(changes) <> 'array' or jsonb_array_length(changes)>200 then raise exception 'Lote inválido'; end if;
 for change in select * from jsonb_array_elements(changes) loop
  if change->>'operation'='delete' then
   delete from public.crm_records where kind=change->>'kind' and id=change->>'id';
   if not found then raise exception 'Registro no accesible'; end if;
  elsif change->>'operation'='save' then
   insert into public.crm_records(kind,id,payload) values(change->>'kind',change->>'id',change->'payload') on conflict(kind,id) do update set payload=excluded.payload;
  else raise exception 'Operación inválida'; end if;
 end loop;
end; $$;
revoke all on function public.apply_crm_changes(jsonb) from public,anon;
grant execute on function public.apply_crm_changes(jsonb) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('coco-profiles','coco-profiles',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
