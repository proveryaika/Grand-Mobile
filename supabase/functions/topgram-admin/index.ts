import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
function getSecretKey(){const raw=Deno.env.get("SUPABASE_SECRET_KEYS");if(raw){try{const parsed=JSON.parse(raw);if(parsed.default)return parsed.default}catch{}}return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??""}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return respond({error:"Method not allowed"},405);
 try{
  const header=req.headers.get("Authorization")??"",token=header.startsWith("Bearer ")?header.slice(7):"";
  if(!token)return respond({error:"Sign-in required"},401);
  const projectUrl=Deno.env.get("SUPABASE_URL")??"",secret=getSecretKey();
  if(!projectUrl||!secret)return respond({error:"Server configuration incomplete"},500);
  const admin=createClient(projectUrl,secret,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:authData,error:authError}=await admin.auth.getUser(token),actor=authData.user;
  if(authError||!actor)return respond({error:"Invalid session"},401);
  const role=actor.app_metadata?.topgram_role;
  if(!["owner","admin"].includes(role))return respond({error:"Admin access required"},403);
  const body=await req.json(),input=body.payload??body,action=String(body.action??"");
  if(["set_admin_role","assign_collectible_username"].includes(action)&&role!=="owner")return respond({error:"Owner role required"},403);
  if(action==="lookup_user"||action==="get_logs"){
   const username=String(input.username??"").trim().toLowerCase();
   if(!/^[a-z0-9_]{5,32}$/.test(username))return respond({error:"Invalid username"},400);
   const {data:target,error}=await admin.from("tg_profiles").select("id,username,display_name,stars,frozen_at,deleted_at,created_at").eq("username",username).maybeSingle();
   if(error)throw error;if(!target)return respond({error:"User not found"},404);
   if(action==="lookup_user")return respond({user:target});
   const {data:logs,error:logError}=await admin.from("tg_audit_logs").select("id,actor_id,target_id,action,details,created_at").eq("target_id",target.id).order("created_at",{ascending:false}).limit(100);
   if(logError)throw logError;return respond({user:target,logs:logs??[]});
  }
  if(action==="set_admin_role"){
   const username=String(input.username??"").trim().toLowerCase(),enabled=input.enabled===true;
   const {data:target,error:lookupError}=await admin.from("tg_profiles").select("id,username").eq("username",username).maybeSingle();
   if(lookupError)throw lookupError;if(!target)return respond({error:"User not found"},404);
   const {data:targetAuth,error:targetError}=await admin.auth.admin.getUserById(target.id);
   if(targetError||!targetAuth.user)throw targetError??new Error("Auth user not found");
   if(targetAuth.user.app_metadata?.topgram_role==="owner")return respond({error:"Owner role cannot be changed here"},409);
   const meta={...(targetAuth.user.app_metadata??{})};if(enabled)meta.topgram_role="admin";else delete meta.topgram_role;
   const {error:updateError}=await admin.auth.admin.updateUserById(target.id,{app_metadata:meta});if(updateError)throw updateError;
   const {error:auditError}=await admin.from("tg_audit_logs").insert({actor_id:actor.id,target_id:target.id,action:enabled?"grant_admin_role":"revoke_admin_role",details:{username}});
   if(auditError)throw auditError;return respond({ok:true,username,role:enabled?"admin":null});
  }
  const allowed=["grant_stars","freeze_user","unfreeze_user","soft_delete_user","assign_collectible_username","create_gift","publish_gift","issue_gift"];
  if(!allowed.includes(action))return respond({error:"Unknown action"},400);
  const {data,error}=await admin.schema("public").rpc("tg_admin_action",{p_actor:actor.id,p_action:action,p_payload:input});
  if(error)return respond({error:error.message},400);
  return respond({ok:true,result:data});
 }catch(error){console.error("topgram-admin error",error);return respond({error:"Request failed. Check values and try again."},400)}
});