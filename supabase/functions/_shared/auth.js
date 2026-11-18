import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
export const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
export const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
function environmentKey(modern,legacy){const keys=JSON.parse(Deno.env.get(modern)||'{}');return keys.default||Object.values(keys)[0]||Deno.env.get(legacy);}
export async function authorize(req,adminOnly=false){
 const token=req.headers.get('Authorization');if(!token?.startsWith('Bearer '))throw Error('No autorizado');
 const client=createClient(Deno.env.get('SUPABASE_URL'),environmentKey('SUPABASE_PUBLISHABLE_KEYS','SUPABASE_ANON_KEY'),{global:{headers:{Authorization:token}},auth:{persistSession:false}});
 const {data:{user},error}=await client.auth.getUser();if(error||!user)throw Error('No autorizado');
 const role=await client.from('user_roles').select('role').eq('user_id',user.id).single();
 if(role.error||!['admin','asesor'].includes(role.data?.role)||adminOnly&&role.data.role!=='admin')throw Error('Sin permisos');
 return {user,client};
}
export function adminClient(){return createClient(Deno.env.get('SUPABASE_URL'),environmentKey('SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});}
