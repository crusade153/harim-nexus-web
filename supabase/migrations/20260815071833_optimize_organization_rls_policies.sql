-- Keep one SELECT policy per table and split administrator writes by command.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'org_units', 'member_role_profiles', 'mbo_objectives',
    'work_responsibilities', 'responsibility_assignments'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_admin_all', table_name);

    execute format('drop policy if exists %I on public.%I', table_name || '_admin_insert', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.is_nexus_admin()))',
      table_name || '_admin_insert', table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_admin_update', table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.is_nexus_admin())) with check ((select private.is_nexus_admin()))',
      table_name || '_admin_update', table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_admin_delete', table_name);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select private.is_nexus_admin()))',
      table_name || '_admin_delete', table_name
    );
  end loop;
end $$;
