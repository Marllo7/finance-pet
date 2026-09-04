-- Migration: convergent chat merge via RPC (no last-writer-wins)
-- Table: chat_messages(id identity, user_id uuid, role text, content text, created_at timestamptz default now())

create or replace function public.save_chat_messages(msgs jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  existing jsonb := '[]'::jsonb;
  incoming jsonb := '[]'::jsonb;
  merged jsonb := '[]'::jsonb;
  r record;
  g record;
  v_role text;
  v_content text;
  v_first boolean;
  v_len int;
  v_i int;
  v_j int;
  v_elem jsonb;
  v_k int;
  v_cnt_e int;
  v_ex_len int;
begin
  if v_uid is null then
    return;
  end if;

  -- Сериализуем параллельные записи одного юзера: иначе два
  -- одновременных RPC interleaved прочитают одно, а запишут каждый своё.
  perform pg_advisory_xact_lock(hashtext(v_uid::text));

  -- 1. existing: строки юзера по (created_at, id), с чисткой
  v_first := true;
  for r in
    select m.role as role, m.content as content
    from public.chat_messages as m
    where m.user_id = v_uid
    order by m.created_at, m.id
  loop
    v_role := r.role;
    v_content := r.content;
    if v_first then
      v_first := false;
      if v_content is not null
        and (v_content like 'Привет!%' or v_content like 'Hi!%')
        and (v_content like '%питомец-помощник%' or v_content like '%pet assistant%')
      then
        continue;
      end if;
    end if;
    if v_role is null or v_role not in ('user', 'assistant') then
      continue;
    end if;
    if v_content is null or btrim(v_content) = '' then
      continue;
    end if;
    existing := existing || jsonb_build_array(jsonb_build_object('role', v_role, 'content', v_content));
  end loop;

  -- 2. incoming: элементы msgs по порядку, с чисткой
  v_first := true;
  if msgs is not null and jsonb_typeof(msgs) = 'array' then
    for g in
      select (e.m ->> 'role') as role, (e.m ->> 'content') as content
      from jsonb_array_elements(msgs) with ordinality as e(m, ord)
      order by e.ord
    loop
      v_role := g.role;
      v_content := g.content;
      if v_first then
        v_first := false;
        if v_content is not null
          and (v_content like 'Привет!%' or v_content like 'Hi!%')
          and (v_content like '%питомец-помощник%' or v_content like '%pet assistant%')
        then
          continue;
        end if;
      end if;
      if v_role is null or v_role not in ('user', 'assistant') then
        continue;
      end if;
      if v_content is null or btrim(v_content) = '' then
        continue;
      end if;
      incoming := incoming || jsonb_build_array(jsonb_build_object('role', v_role, 'content', v_content));
    end loop;
  end if;

  -- 3. convergent union с кратностью max(existing, incoming):
  -- merged = existing + недостающие из incoming по порядку.
  -- ИСКЛЮЧЕНИЕ: пустой incoming при непустом existing = явная очистка чата
  -- (clearHistory). Без этого merged оставался бы = existing и удаление
  -- воскрешало бы сообщения (delete + insert тех же строк).
  merged := existing;
  v_len := coalesce(jsonb_array_length(incoming), 0);
  v_ex_len := coalesce(jsonb_array_length(existing), 0);
  if v_len = 0 and v_ex_len > 0 then
    merged := '[]'::jsonb;
  elsif v_len > 0 then
    for v_i in 0..v_len - 1 loop
      v_elem := incoming -> v_i;
      v_role := v_elem ->> 'role';
      v_content := v_elem ->> 'content';
      -- k = порядковый номер вхождения ключа в incoming (1-based, включительно)
      v_k := 0;
      for v_j in 0..v_i loop
        if (incoming -> v_j ->> 'role') is not distinct from v_role
          and (incoming -> v_j ->> 'content') is not distinct from v_content
        then
          v_k := v_k + 1;
        end if;
      end loop;
      -- cnt_e = всего вхождений ключа в existing
      v_cnt_e := 0;
      if v_ex_len > 0 then
        for v_j in 0..v_ex_len - 1 loop
          if (existing -> v_j ->> 'role') is not distinct from v_role
            and (existing -> v_j ->> 'content') is not distinct from v_content
          then
            v_cnt_e := v_cnt_e + 1;
          end if;
        end loop;
      end if;
      if v_k > v_cnt_e then
        merged := merged || jsonb_build_array(v_elem);
      end if;
    end loop;
  end if;

  -- 4. cap: последние 100
  v_len := coalesce(jsonb_array_length(merged), 0);
  if v_len > 100 then
    select coalesce(jsonb_agg(e.m order by e.ord), '[]'::jsonb) into merged
    from jsonb_array_elements(merged) with ordinality as e(m, ord)
    where e.ord > v_len - 100;
  end if;

  -- 5. атомарная замена (пусто + пусто = просто delete => clearHistory работает)
  delete from public.chat_messages where user_id = v_uid;

  v_len := coalesce(jsonb_array_length(merged), 0);
  if v_len > 0 then
    insert into public.chat_messages (user_id, role, content, created_at)
    select
      v_uid,
      (e.m ->> 'role'),
      (e.m ->> 'content'),
      v_now + (e.ord * interval '1 millisecond')
    from jsonb_array_elements(merged) with ordinality as e(m, ord);
  end if;
end;
$$;

grant execute on function public.save_chat_messages(jsonb) to authenticated;
