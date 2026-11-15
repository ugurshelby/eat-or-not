-- Yer misin Yemez misin — şema
-- Tablolar RLS ile tamamen kapalı; istemci sadece SECURITY DEFINER RPC'leri çağırır.
-- Kimlik: her oyuncunun tarayıcısında saklanan gizli bir token (uuid).

create extension if not exists pgcrypto;

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 24),
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  p1 uuid not null references public.players(id) on delete cascade,
  p2 uuid references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rounds (
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_no int not null check (round_no >= 1),
  items text[] not null,
  created_at timestamptz not null default now(),
  primary key (room_id, round_no)
);

-- choice: 1 = yerim, 0 = yemem, 2 = hiç denemedim
create table if not exists public.answers (
  room_id uuid not null,
  round_no int not null,
  idx smallint not null check (idx between 0 and 49),
  player_id uuid not null references public.players(id) on delete cascade,
  choice smallint not null check (choice in (0, 1, 2)),
  created_at timestamptz not null default now(),
  primary key (room_id, round_no, idx, player_id),
  foreign key (room_id, round_no) references public.rounds(room_id, round_no) on delete cascade
);

create index if not exists rooms_p1_idx on public.rooms(p1);
create index if not exists rooms_p2_idx on public.rooms(p2);
create index if not exists answers_player_idx on public.answers(player_id);

alter table public.players enable row level security;
alter table public.rooms enable row level security;
alter table public.rounds enable row level security;
alter table public.answers enable row level security;
-- Bilerek hiç policy yok: doğrudan tablo erişimi kapalı.

-- ---------- yardımcılar ----------
create or replace function public._player(p_token uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.players where token = p_token
$$;

create or replace function public._room_member(p_room uuid, p_player uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.rooms r where r.id = p_room and (r.p1 = p_player or r.p2 = p_player))
$$;

-- ---------- RPC'ler ----------
create or replace function public.create_player(p_name text)
returns json language plpgsql security definer set search_path = '' as $$
declare v public.players;
begin
  insert into public.players(name) values (btrim(p_name)) returning * into v;
  return json_build_object('id', v.id, 'token', v.token, 'name', v.name);
end $$;

create or replace function public.rename_player(p_token uuid, p_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.players set name = btrim(p_name) where token = p_token;
end $$;

create or replace function public.create_room(p_token uuid)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_player uuid := public._player(p_token);
  v_code text;
  v_room public.rooms;
  alphabet text := 'ABCDEFGHJKLMNPRSTUVYZ23456789';
  i int;
begin
  if v_player is null then raise exception 'unknown player'; end if;
  loop
    v_code := '';
    for i in 1..4 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.rooms(code, p1) values (v_code, v_player) returning * into v_room;
      exit;
    exception when unique_violation then
      -- tekrar dene
    end;
  end loop;
  return json_build_object('id', v_room.id, 'code', v_room.code);
end $$;

create or replace function public.join_room(p_token uuid, p_code text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_player uuid := public._player(p_token);
  v_room public.rooms;
begin
  if v_player is null then raise exception 'unknown player'; end if;
  select * into v_room from public.rooms where code = upper(btrim(p_code)) for update;
  if v_room.id is null then raise exception 'room not found'; end if;
  if v_room.p1 = v_player or v_room.p2 = v_player then
    return json_build_object('id', v_room.id, 'code', v_room.code);
  end if;
  if v_room.p2 is not null then raise exception 'room full'; end if;
  update public.rooms set p2 = v_player, updated_at = now() where id = v_room.id;
  return json_build_object('id', v_room.id, 'code', v_room.code);
end $$;

create or replace function public.ensure_round(p_token uuid, p_room uuid, p_round int, p_items text[])
returns text[] language plpgsql security definer set search_path = '' as $$
declare
  v_player uuid := public._player(p_token);
  v_items text[];
begin
  if not public._room_member(p_room, v_player) then raise exception 'not a member'; end if;
  if array_length(p_items, 1) is null or array_length(p_items, 1) > 50 then raise exception 'bad items'; end if;
  insert into public.rounds(room_id, round_no, items) values (p_room, p_round, p_items)
  on conflict (room_id, round_no) do nothing;
  select items into v_items from public.rounds where room_id = p_room and round_no = p_round;
  update public.rooms set updated_at = now() where id = p_room;
  return v_items;
end $$;

-- Cevap verir; partner de cevap verdiyse onun cevabını döner (yoksa null).
create or replace function public.submit_answer(p_token uuid, p_room uuid, p_round int, p_idx int, p_choice int)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_player uuid := public._player(p_token);
  v_mine smallint;
  v_theirs smallint;
begin
  if not public._room_member(p_room, v_player) then raise exception 'not a member'; end if;
  insert into public.answers(room_id, round_no, idx, player_id, choice)
  values (p_room, p_round, p_idx, v_player, p_choice)
  on conflict do nothing;
  select choice into v_mine from public.answers
    where room_id = p_room and round_no = p_round and idx = p_idx and player_id = v_player;
  select choice into v_theirs from public.answers
    where room_id = p_room and round_no = p_round and idx = p_idx and player_id <> v_player;
  update public.rooms set updated_at = now() where id = p_room;
  return json_build_object('mine', v_mine, 'theirs', v_theirs);
end $$;

-- Odanın tüm durumu. Partnerin cevabı, sadece ben de aynı karta cevap verdiysem görünür.
create or replace function public.get_room_state(p_token uuid, p_room uuid)
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  v_player uuid := public._player(p_token);
  v_room public.rooms;
  v_partner uuid;
begin
  if not public._room_member(p_room, v_player) then raise exception 'not a member'; end if;
  select * into v_room from public.rooms where id = p_room;
  v_partner := case when v_room.p1 = v_player then v_room.p2 else v_room.p1 end;
  return json_build_object(
    'room', json_build_object('id', v_room.id, 'code', v_room.code, 'created_at', v_room.created_at),
    'me', (select json_build_object('id', id, 'name', name) from public.players where id = v_player),
    'partner', (select json_build_object('id', id, 'name', name) from public.players where id = v_partner),
    'rounds', coalesce((select json_agg(json_build_object('round_no', round_no, 'items', items) order by round_no)
                        from public.rounds where room_id = p_room), '[]'::json),
    'answers', coalesce((
      select json_agg(json_build_object(
        'round_no', k.round_no, 'idx', k.idx,
        'mine', m.choice,
        'theirs', case when m.choice is not null then t.choice end,
        'theirs_done', t.choice is not null
      ) order by k.round_no, k.idx)
      from (select distinct round_no, idx from public.answers where room_id = p_room) k
      left join public.answers m on m.room_id = p_room and m.round_no = k.round_no and m.idx = k.idx and m.player_id = v_player
      left join public.answers t on t.room_id = p_room and t.round_no = k.round_no and t.idx = k.idx and t.player_id = v_partner
    ), '[]'::json)
  );
end $$;

create or replace function public.list_my_rooms(p_token uuid)
returns json language plpgsql stable security definer set search_path = '' as $$
declare v_player uuid := public._player(p_token);
begin
  if v_player is null then raise exception 'unknown player'; end if;
  return coalesce((
    select json_agg(json_build_object(
      'id', r.id, 'code', r.code, 'updated_at', r.updated_at,
      'partner', (select name from public.players p where p.id = case when r.p1 = v_player then r.p2 else r.p1 end),
      'rounds', (select count(*) from public.rounds x where x.room_id = r.id)
    ) order by r.updated_at desc)
    from public.rooms r where r.p1 = v_player or r.p2 = v_player
  ), '[]'::json);
end $$;

revoke all on function public._player(uuid) from public, anon, authenticated;
revoke all on function public._room_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_player(text) to anon, authenticated;
grant execute on function public.rename_player(uuid, text) to anon, authenticated;
grant execute on function public.create_room(uuid) to anon, authenticated;
grant execute on function public.join_room(uuid, text) to anon, authenticated;
grant execute on function public.ensure_round(uuid, uuid, int, text[]) to anon, authenticated;
grant execute on function public.submit_answer(uuid, uuid, int, int, int) to anon, authenticated;
grant execute on function public.get_room_state(uuid, uuid) to anon, authenticated;
grant execute on function public.list_my_rooms(uuid) to anon, authenticated;
