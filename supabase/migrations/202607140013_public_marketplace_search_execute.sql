-- Public marketplace discovery is intentionally read-only. The underlying
-- function is STABLE SQL and returns only published vendor profile fields.
-- Keep the existing SECURITY DEFINER/search_path='' posture and expose only
-- this narrowly scoped search function to anonymous visitors.
grant execute on function public.search_vendor_marketplace(text,uuid,uuid,boolean,boolean,boolean,boolean,boolean,integer,integer) to anon;

comment on function public.search_vendor_marketplace(text,uuid,uuid,boolean,boolean,boolean,boolean,boolean,integer,integer)
  is 'Read-only public marketplace discovery; returns governed vendor fields and never accepts writes.';
