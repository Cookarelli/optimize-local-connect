begin;

update public.profiles
set is_super_admin = true
where id = '7edb8abb-1b0e-418f-89ba-f25a38efe299'
  and is_super_admin = false;

commit;
