import { FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { tools } from "@/data/tools";
import { supabase, backendConfigured } from "@/lib/supabase";

export default function Claim(){
  const {slug}=useParams();
  const foundTool=tools.find(t=>t.slug===slug);
  const [status,setStatus]=useState("");
  if(!foundTool)return <div className="mx-auto max-w-3xl px-4 py-20"><h1 className="text-3xl font-semibold">Listing not found</h1><Link to="/" className="mt-4 inline-block text-teal">Back to directory</Link></div>;
  const tool=foundTool;
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setStatus("Submitting…");const f=new FormData(e.currentTarget);if(!supabase){setStatus("Claim backend is not configured yet.");return;}const{error}=await supabase.from("tool_claims").insert({tool_slug:tool.slug,tool_name:tool.name,website:tool.website,claimant_name:String(f.get("name")),claimant_email:String(f.get("email")),company_role:String(f.get("role")||""),message:String(f.get("message")||"")});setStatus(error?"Could not submit claim right now.":"Claim submitted. We will verify ownership before making changes.");if(!error)e.currentTarget.reset();}
  return <div className="mx-auto max-w-3xl px-4 py-10"><SEO title={`Claim ${tool.name} — Anjal AI`} description={`Claim the ${tool.name} listing on Anjal AI.`} canonical={`${window.location.origin}/claim/${tool.slug}`} /><div className="rounded-3xl border border-line bg-white p-7 shadow-card dark:border-line-dark dark:bg-surface-dark"><p className="text-sm text-teal">Claim listing</p><h1 className="mt-2 text-3xl font-semibold">Claim {tool.name}</h1><p className="mt-2 text-slate">Provide business details so we can verify ownership and update the listing.</p><form onSubmit={submit} className="mt-8 space-y-4"><input required name="name" placeholder="Your full name" className="w-full rounded-xl border border-line bg-transparent p-3 outline-none dark:border-line-dark"/><input required type="email" name="email" placeholder="Business email" className="w-full rounded-xl border border-line bg-transparent p-3 outline-none dark:border-line-dark"/><input name="role" placeholder="Role (Founder, Marketing, etc.)" className="w-full rounded-xl border border-line bg-transparent p-3 outline-none dark:border-line-dark"/><textarea name="message" rows={5} placeholder="What would you like to update?" className="w-full rounded-xl border border-line bg-transparent p-3 outline-none dark:border-line-dark"/><button disabled={!backendConfigured} className="w-full rounded-xl bg-teal px-5 py-3 font-semibold text-white disabled:opacity-50">Submit claim</button></form>{status&&<p className="mt-4 text-sm text-slate">{status}</p>}</div></div>
}
