-- Kişisel giriş linkleri, oda silme ve uyku önleyici ping.
-- Not: Kişisel link anahtarları (link_key) burada DEĞİL, sadece SQL editöründen elle eklenir.

alter table public.players add column if not exists link_key text unique;
alter table public.players add column if not exists home_room uuid references public.rooms(id) on delete set null;

-- Kişisel linkten kimliği geri yükler. Sadece okur.
create or replace function public.claim_link(p_key text)
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object('id', p.id, 'token', p.token, 'name', p.name, 'home_room', p.home_room)
  from public.players p
  where p.link_key is not null and p.link_key = p_key
$$;

-- Odayı (turları ve cevaplarıyla) siler. Sadece odadaki oyuncular silebilir.
-- Birinin "ev odası" olarak işaretli oda silinemez.
create or replace function public.delete_room(p_token uuid, p_room uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_player uuid := public._player(p_token);
begin
  if not public._room_member(p_room, v_player) then raise exception 'not a member'; end if;
  if exists (select 1 from public.players where home_room = p_room) then raise exception 'protected room'; end if;
  delete from public.rooms where id = p_room;
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
      'rounds', (select count(*) from public.rounds x where x.room_id = r.id),
      'is_home', exists (select 1 from public.players h where h.home_room = r.id)
    ) order by r.updated_at desc)
    from public.rooms r where r.p1 = v_player or r.p2 = v_player
  ), '[]'::json);
end $$;

-- Uyku önleyici: gerçek bir sorgu yapar.
create or replace function public.ping()
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object('ok', true, 'rooms', (select count(*) from public.rooms), 'at', now())
$$;

grant execute on function public.claim_link(text) to anon, authenticated;
grant execute on function public.delete_room(uuid, uuid) to anon, authenticated;
grant execute on function public.list_my_rooms(uuid) to anon, authenticated;
grant execute on function public.ping() to anon, authenticated;
