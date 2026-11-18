import {authorize,adminClient,headers,reply} from '../_shared/auth.js';
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response(null,{headers});if(req.method!=='POST')return reply({error:'Método inválido'},405);
 try{await authorize(req,true);}catch{return reply({error:'Sin autorización'},403);}
 let body;try{body=await req.json();}catch{return reply({error:'JSON inválido'},400);}
 const {name,email,password}=body;
 if(typeof name!=='string'||name.trim().length<2||typeof email!=='string'||!/^\S+@\S+\.\S+$/.test(email)||typeof password!=='string'||password.length<10)return reply({error:'Datos inválidos'},400);
 const admin=adminClient();let id;
 try{const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:name.trim()}});if(error)throw error;id=data.user.id;
 const r=await admin.from('user_roles').insert({user_id:id,role:'asesor'});if(r.error)throw r.error;
 const c=await admin.from('crm_records').insert({kind:'advisors',id,payload:{id,name:name.trim()}});if(c.error)throw c.error;
 return reply({id});
 }catch{if(id)await admin.auth.admin.deleteUser(id);return reply({error:'No se pudo crear el asesor. Revisa si el correo ya existe.'},400);}
});
