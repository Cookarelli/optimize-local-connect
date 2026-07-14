begin;

create or replace function public.get_platform_impact_summary(target_start_date date default null,target_end_date date default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.is_super_admin() then raise exception 'super admin required'; end if;
  select jsonb_build_object(
    'estimated_money_saved_cents',coalesce(sum(d.estimated_money_saved_cents),0),
    'estimated_hours_saved',coalesce(sum(d.estimated_hours_saved),0),
    'average_savings_per_work_order_cents',case when coalesce(sum(d.jobs_completed),0)>0 then round(sum(d.estimated_money_saved_cents)::numeric/sum(d.jobs_completed)) else 0 end,
    'vendor_response_minutes',case when coalesce(sum(d.vendor_response_count),0)>0 then round(sum(d.vendor_response_minutes_sum)/sum(d.vendor_response_count),2) else null end,
    'emergency_response_minutes',case when coalesce(sum(d.emergency_response_count),0)>0 then round(sum(d.emergency_response_minutes_sum)/sum(d.emergency_response_count),2) else null end,
    'community_savings_since_launch_cents',(select coalesce(sum(all_time.estimated_money_saved_cents),0) from public.daily_impact_metrics all_time),
    'jobs_completed',coalesce(sum(d.jobs_completed),0),
    'vendor_growth',coalesce(sum(d.vendor_growth_count),0),
    'local_spending_retained_cents',coalesce(sum(d.local_spending_retained_cents),0),
    'organization_count',count(distinct d.organization_id),
    'communities_served',(select count(distinct o.city_id) from public.impact_observations o where o.city_id is not null and o.metric_key='jobs_completed' and o.value>0),
    'verified_vendor_count',(
      select count(*) from public.vendor_profiles vp where vp.verification_status='verified'
        and exists(select 1 from public.vendor_verifications v where v.vendor_organization_id=vp.organization_id and v.verification_type='trade_license' and v.status='verified' and (v.expires_on is null or v.expires_on>=current_date))
        and exists(select 1 from public.vendor_verifications v where v.vendor_organization_id=vp.organization_id and v.verification_type='insurance' and v.status='verified' and (v.expires_on is null or v.expires_on>=current_date))
    ),
    'property_manager_count',(
      select count(distinct m.user_id) from public.organization_members m join public.organizations o on o.id=m.organization_id
      where o.type='property_management' and o.status='active' and m.status='active' and m.role in('owner','admin','property_manager')
    ),
    'city_comparison_ready',true,
    'generated_at',now()
  ) into result from public.daily_impact_metrics d
  where (target_start_date is null or d.metric_date>=target_start_date) and (target_end_date is null or d.metric_date<=target_end_date);
  return result;
end $$;

create or replace function public.get_city_impact_summary(target_start_date date,target_end_date date)
returns table(
  city_id uuid,city_name text,state_code text,estimated_money_saved_cents bigint,estimated_hours_saved numeric,
  jobs_completed bigint,local_spending_retained_cents bigint,vendor_response_minutes numeric,
  emergency_response_minutes numeric,vendor_growth bigint,verified_vendor_count bigint
) language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_super_admin() then raise exception 'super admin required'; end if;
  if target_start_date is null or target_end_date is null or target_end_date<target_start_date then raise exception 'invalid city comparison period'; end if;
  return query
  with observed as (
    select o.city_id,
      sum(o.value) filter(where o.metric_key='estimated_money_saved')::bigint money,
      sum(o.value) filter(where o.metric_key='estimated_hours_saved') hours,
      sum(o.value) filter(where o.metric_key='jobs_completed')::bigint jobs,
      sum(o.value) filter(where o.metric_key='local_spending_retained')::bigint local_retained,
      avg(o.value) filter(where o.metric_key='vendor_response_time') response_minutes,
      avg(o.value) filter(where o.metric_key='emergency_response_time') emergency_minutes,
      sum(o.value) filter(where o.metric_key='vendor_growth')::bigint growth
    from public.impact_observations o
    where o.city_id is not null and o.observed_at::date between target_start_date and target_end_date
    group by o.city_id
  )
  select c.id,c.name,c.state_code,coalesce(x.money,0),coalesce(x.hours,0),coalesce(x.jobs,0),coalesce(x.local_retained,0),
    round(x.response_minutes,2),round(x.emergency_minutes,2),coalesce(x.growth,0),
    (select count(distinct vsc.vendor_organization_id) from public.vendor_service_cities vsc join public.vendor_profiles vp on vp.organization_id=vsc.vendor_organization_id
      where vsc.city_id=c.id and vsc.is_active and vp.verification_status='verified'
        and exists(select 1 from public.vendor_verifications v where v.vendor_organization_id=vp.organization_id and v.verification_type='trade_license' and v.status='verified' and (v.expires_on is null or v.expires_on>=current_date))
        and exists(select 1 from public.vendor_verifications v where v.vendor_organization_id=vp.organization_id and v.verification_type='insurance' and v.status='verified' and (v.expires_on is null or v.expires_on>=current_date)))
  from observed x join public.cities c on c.id=x.city_id
  order by coalesce(x.money,0) desc,coalesce(x.jobs,0) desc,c.name;
end $$;

grant execute on function public.get_city_impact_summary(date,date) to authenticated;
comment on function public.get_city_impact_summary is 'Super Admin city comparison read model derived from immutable Impact Engine observations and current verified vendor coverage.';

commit;
