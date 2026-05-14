-- 0011_notes_core.sql
-- Team-scoped notes, append-only MOC operations, wiki-link index, and audit
-- revisions for the notes core API.

create extension if not exists citext;
create extension if not exists pg_trgm;
create extension if not exists unaccent;

create table public.notes (
  id                       uuid primary key default gen_random_uuid(),
  team_id                  uuid not null references public.teams(id) on delete cascade,
  slug                     citext not null,
  folder                   text not null default '00_inbox',
  title                    text not null,
  body                     text not null default '',
  frontmatter              jsonb not null default '{}'::jsonb,
  version                  integer not null default 1 check (version > 0),
  created_by               uuid,
  created_by_type          text not null check (created_by_type in ('human', 'agent')),
  updated_by               uuid,
  updated_by_type          text not null check (updated_by_type in ('human', 'agent')),
  archived_at              timestamptz,
  archived_reason          text,
  archived_original_folder text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (team_id, slug)
);

create index notes_team_folder_idx on public.notes (team_id, folder);
create index notes_team_updated_at_idx on public.notes (team_id, updated_at desc);
create index notes_active_slug_trgm_idx
  on public.notes using gin ((slug::text) gin_trgm_ops)
  where archived_at is null;

create table public.note_revisions (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null references public.teams(id) on delete cascade,
  note_id        uuid not null references public.notes(id) on delete cascade,
  version        integer not null check (version > 0),
  op_type        text not null check (
    op_type in ('create', 'edit', 'append', 'link', 'archive', 'restore')
  ),
  author_id      uuid,
  author_type    text not null check (author_type in ('human', 'agent', 'system')),
  before_body    text,
  after_body     text,
  summary        text,
  diff_preview   text,
  created_at     timestamptz not null default now(),
  unique (note_id, version, op_type)
);

create index note_revisions_note_created_at_idx
  on public.note_revisions (note_id, created_at desc);

create table public.note_links (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  source_id   uuid not null references public.notes(id) on delete cascade,
  target_slug citext not null,
  created_at  timestamptz not null default now(),
  unique (team_id, source_id, target_slug)
);

create index note_links_target_idx
  on public.note_links (team_id, target_slug);

create table public.moc_appends (
  id               uuid primary key default gen_random_uuid(),
  team_id          uuid not null references public.teams(id) on delete cascade,
  note_id          uuid not null references public.notes(id) on delete cascade,
  section          text not null,
  text             text not null,
  wiki_links       citext[] not null default '{}',
  appended_by      uuid,
  appended_by_type text not null check (appended_by_type in ('human', 'agent')),
  created_at       timestamptz not null default now()
);

create index moc_appends_note_created_at_idx
  on public.moc_appends (note_id, created_at, id);

create or replace function public.notes_actor_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.note_author_id', true), '')::uuid
$$;

create or replace function public.notes_actor_type()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('app.note_author_type', true), ''), 'system')
$$;

create or replace function public.notes_op_type()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('app.note_op_type', true), ''), 'edit')
$$;

create or replace function public.notes_diff_preview(before_text text, after_text text)
returns text
language sql
immutable
as $$
  select left(
    concat(
      'before: ',
      coalesce(left(before_text, 220), ''),
      E'\nafter: ',
      coalesce(left(after_text, 220), '')
    ),
    500
  )
$$;

create or replace function public.notes_body_without_fenced_code(body text)
returns text
language plpgsql
immutable
as $$
declare
  line text;
  in_fence boolean := false;
  stripped text := '';
begin
  foreach line in array regexp_split_to_array(coalesce(body, ''), E'\n') loop
    if line ~ '^[[:space:]]*```' then
      in_fence := not in_fence;
    elsif not in_fence then
      stripped := stripped || line || E'\n';
    end if;
  end loop;

  return stripped;
end;
$$;

-- Mirrors slugifyTitle() in apps/web/src/lib/notes/markdown.ts so the
-- link-refresh trigger persists canonical slugs (lowercase, ASCII, hyphenated)
-- instead of the raw inner text of `[[ ... ]]`. Keep these in sync.
create or replace function public.notes_slugify(input text)
returns text
language sql
immutable
as $$
  select case
    when slug = '' then 'untitled'
    else slug
  end
  from (
    select regexp_replace(
      regexp_replace(
        lower(unaccent(coalesce(regexp_replace(input, '\.md$', '', 'i'), ''))),
        '[^a-z0-9]+',
        '-',
        'g'
      ),
      '^-+|-+$',
      '',
      'g'
    ) as slug
  ) s
$$;

create or replace function public.refresh_note_links()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  delete from public.note_links where source_id = new.id;

  insert into public.note_links (team_id, source_id, target_slug)
  select distinct new.team_id, new.id, public.notes_slugify(link_match[1])::citext
  from regexp_matches(
    public.notes_body_without_fenced_code(new.body),
    '\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]',
    'g'
  ) as m(link_match)
  where btrim(link_match[1]) <> ''
  on conflict do nothing;

  return new;
end;
$$;

create or replace function public.note_revision_after_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into public.note_revisions (
    team_id,
    note_id,
    version,
    op_type,
    author_id,
    author_type,
    before_body,
    after_body,
    summary,
    diff_preview
  ) values (
    new.team_id,
    new.id,
    new.version,
    coalesce(nullif(current_setting('app.note_op_type', true), ''), 'create'),
    coalesce(public.notes_actor_id(), new.created_by),
    coalesce(nullif(current_setting('app.note_author_type', true), ''), new.created_by_type),
    null,
    new.body,
    nullif(current_setting('app.note_summary', true), ''),
    public.notes_diff_preview(null, new.body)
  );

  return new;
end;
$$;

create or replace function public.note_revision_before_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();

  if public.notes_actor_id() is not null then
    new.updated_by := public.notes_actor_id();
  end if;

  if public.notes_actor_type() in ('human', 'agent') then
    new.updated_by_type := public.notes_actor_type();
  end if;

  return new;
end;
$$;

create or replace function public.note_revision_after_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  insert into public.note_revisions (
    team_id,
    note_id,
    version,
    op_type,
    author_id,
    author_type,
    before_body,
    after_body,
    summary,
    diff_preview
  ) values (
    new.team_id,
    new.id,
    new.version,
    public.notes_op_type(),
    public.notes_actor_id(),
    public.notes_actor_type(),
    old.body,
    new.body,
    nullif(current_setting('app.note_summary', true), ''),
    public.notes_diff_preview(old.body, new.body)
  );

  return new;
end;
$$;

create or replace function public.render_moc_append_line(
  append_created_at timestamptz,
  author_type text,
  author_id uuid,
  append_text text,
  append_links citext[]
)
returns text
language plpgsql
stable
as $$
declare
  author_label text := author_type || ':' || coalesce(author_id::text, 'unknown');
  links_text text := '';
begin
  if array_length(append_links, 1) is not null then
    select string_agg('[[' || link::text || ']]', ' ')
      into links_text
    from unnest(append_links) as link;
  end if;

  return '- [' || to_char(append_created_at at time zone 'UTC', 'YYYY-MM-DD') ||
    ' ' || author_label || '] ' ||
    btrim(append_text || case when links_text = '' then '' else ' ' || links_text end);
end;
$$;

create or replace function public.note_section_heading(section_name text)
returns text
language sql
immutable
as $$
  select case section_name
    when 'breadcrumbs' then 'Breadcrumbs'
    when 'open_questions' then 'Open Questions'
    when 'key_notes' then 'Key Notes'
    when 'sources' then 'Sources'
    else initcap(replace(section_name, '_', ' '))
  end
$$;

create or replace function public.append_to_note_section(
  existing_body text,
  section_name text,
  append_line text
)
returns text
language plpgsql
immutable
as $$
declare
  heading text := '## ' || public.note_section_heading(section_name);
  lines text[];
  output text[] := '{}';
  line text;
  inserted boolean := false;
  in_section boolean := false;
begin
  lines := regexp_split_to_array(coalesce(existing_body, ''), E'\n');

  foreach line in array lines loop
    if line = heading then
      in_section := true;
      output := output || line;
    elsif in_section and line ~ '^##\s+' then
      output := output || append_line || line;
      inserted := true;
      in_section := false;
    else
      output := output || line;
    end if;
  end loop;

  if in_section and not inserted then
    output := output || append_line;
    inserted := true;
  end if;

  if not inserted then
    if array_length(output, 1) is null or array_to_string(output, E'\n') = '' then
      return heading || E'\n' || append_line;
    end if;

    return array_to_string(output, E'\n') || E'\n\n' || heading || E'\n' || append_line;
  end if;

  return array_to_string(output, E'\n');
end;
$$;

create or replace function public.moc_append_after_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  append_line text;
begin
  perform set_config('app.note_op_type', 'append', true);
  perform set_config('app.note_author_id', coalesce(new.appended_by::text, ''), true);
  perform set_config('app.note_author_type', new.appended_by_type, true);
  perform set_config('app.note_summary', 'append to ' || new.section, true);

  append_line := public.render_moc_append_line(
    new.created_at,
    new.appended_by_type,
    new.appended_by,
    new.text,
    new.wiki_links
  );

  update public.notes
     set body = public.append_to_note_section(body, new.section, append_line)
   where id = new.note_id
     and team_id = new.team_id;

  return new;
end;
$$;

create trigger notes_revision_before_update
before update on public.notes
for each row execute function public.note_revision_before_update();

create trigger notes_revision_after_insert
after insert on public.notes
for each row execute function public.note_revision_after_insert();

create trigger notes_revision_after_update
after update on public.notes
for each row execute function public.note_revision_after_update();

create trigger notes_refresh_links_after_insert
after insert on public.notes
for each row execute function public.refresh_note_links();

create trigger notes_refresh_links_after_update
after update of body on public.notes
for each row execute function public.refresh_note_links();

create trigger moc_appends_apply_after_insert
after insert on public.moc_appends
for each row execute function public.moc_append_after_insert();

create view public.notes_with_meta
with (security_invoker = true)
as
select
  n.*,
  coalesce(r.revision_count, 0)::integer as revision_count,
  coalesce(r.last_activity_at, n.updated_at) as last_activity_at,
  r.last_author_id,
  r.last_author_type
from public.notes n
left join lateral (
  select
    count(*) as revision_count,
    max(created_at) as last_activity_at,
    (array_agg(author_id order by created_at desc))[1] as last_author_id,
    (array_agg(author_type order by created_at desc))[1] as last_author_type
  from public.note_revisions nr
  where nr.note_id = n.id
) r on true;

alter table public.notes enable row level security;
alter table public.note_revisions enable row level security;
alter table public.note_links enable row level security;
alter table public.moc_appends enable row level security;

create policy notes_select_team
on public.notes for select
to authenticated
using (team_id = public.app_current_team());

create policy notes_insert_team
on public.notes for insert
to authenticated
with check (team_id = public.app_current_team());

create policy notes_update_team
on public.notes for update
to authenticated
using (team_id = public.app_current_team())
with check (team_id = public.app_current_team());

create policy note_revisions_select_team
on public.note_revisions for select
to authenticated
using (team_id = public.app_current_team());

create policy note_revisions_insert_team
on public.note_revisions for insert
to authenticated
with check (team_id = public.app_current_team());

create policy note_links_select_team
on public.note_links for select
to authenticated
using (team_id = public.app_current_team());

create policy note_links_insert_team
on public.note_links for insert
to authenticated
with check (team_id = public.app_current_team());

create policy note_links_delete_team
on public.note_links for delete
to authenticated
using (team_id = public.app_current_team());

create policy moc_appends_select_team
on public.moc_appends for select
to authenticated
using (team_id = public.app_current_team());

create policy moc_appends_insert_team
on public.moc_appends for insert
to authenticated
with check (team_id = public.app_current_team());
