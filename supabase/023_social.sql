-- Run once in the Supabase SQL editor (after 022). Safe to run again.
-- Social: real posts and stories (text on a flag background, or a photo with a caption),
-- comments with replies, and likes. A manager sees his own posts and the posts of the
-- managers he shares a league room with, or is friends with.

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('post', 'story')),
  caption text not null default '' check (char_length(caption) <= 500),
  image_url text,
  bg text,
  club_id text,
  author_name text,
  created_at timestamptz not null default now(),
  check (char_length(caption) > 0 or image_url is not null)
);
create index if not exists social_posts_time_idx on public.social_posts (created_at desc);
create index if not exists social_posts_user_idx on public.social_posts (user_id, created_at desc);

create table if not exists public.social_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text,
  parent_id uuid references public.social_comments(id) on delete cascade,
  reply_to text,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists social_comments_post_idx on public.social_comments (post_id, created_at);

create table if not exists public.social_likes (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- who may see what: me, the managers of my rooms, and my friends
create or replace function public.social_sees(author uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select author = auth.uid()
    or exists (
      select 1 from public.room_members a join public.room_members b on a.room_id = b.room_id
      where a.user_id = auth.uid() and b.user_id = author)
    or exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester = auth.uid() and f.addressee = author) or (f.addressee = auth.uid() and f.requester = author)))
$$;

create or replace function public.social_post_visible(pid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.social_posts p where p.id = pid and public.social_sees(p.user_id))
$$;

-- a reply must belong to a comment of the same post
create or replace function public.social_parent_ok(pid uuid, parent uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select parent is null or exists (select 1 from public.social_comments c where c.id = parent and c.post_id = pid)
$$;

alter table public.social_posts enable row level security;
alter table public.social_comments enable row level security;
alter table public.social_likes enable row level security;

drop policy if exists "social posts read" on public.social_posts;
drop policy if exists "social posts add" on public.social_posts;
drop policy if exists "social posts delete" on public.social_posts;
create policy "social posts read" on public.social_posts for select to authenticated using (public.social_sees(user_id));
create policy "social posts add" on public.social_posts for insert to authenticated with check (auth.uid() = user_id);
create policy "social posts delete" on public.social_posts for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "social comments read" on public.social_comments;
drop policy if exists "social comments add" on public.social_comments;
drop policy if exists "social comments delete" on public.social_comments;
create policy "social comments read" on public.social_comments for select to authenticated using (public.social_post_visible(post_id));
create policy "social comments add" on public.social_comments for insert to authenticated
  with check (auth.uid() = user_id and public.social_post_visible(post_id) and public.social_parent_ok(post_id, parent_id));
create policy "social comments delete" on public.social_comments for delete to authenticated
  using (auth.uid() = user_id or exists (select 1 from public.social_posts p where p.id = post_id and p.user_id = auth.uid()));

drop policy if exists "social likes read" on public.social_likes;
drop policy if exists "social likes add" on public.social_likes;
drop policy if exists "social likes delete" on public.social_likes;
create policy "social likes read" on public.social_likes for select to authenticated using (public.social_post_visible(post_id));
create policy "social likes add" on public.social_likes for insert to authenticated with check (auth.uid() = user_id and public.social_post_visible(post_id));
create policy "social likes delete" on public.social_likes for delete to authenticated using (auth.uid() = user_id);

-- no editing of a post after it is published
revoke update on public.social_posts, public.social_comments, public.social_likes from authenticated, anon;

-- photos: a public bucket, each manager writes only inside his own folder
insert into storage.buckets (id, name, public) values ('social-media', 'social-media', true) on conflict (id) do nothing;
drop policy if exists "social media read" on storage.objects;
drop policy if exists "social media add" on storage.objects;
drop policy if exists "social media delete" on storage.objects;
create policy "social media read" on storage.objects for select using (bucket_id = 'social-media');
create policy "social media add" on storage.objects for insert to authenticated
  with check (bucket_id = 'social-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "social media delete" on storage.objects for delete to authenticated
  using (bucket_id = 'social-media' and (storage.foldername(name))[1] = auth.uid()::text);
