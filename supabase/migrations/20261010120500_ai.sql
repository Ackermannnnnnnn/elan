-- =============================================================================
-- 0006 · IA : conversations du coach et journal d'usage
-- Aucune clé d'API ni secret n'est stocké en base.
-- =============================================================================

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('nutrition_coach', 'training_coach')),
  title text check (char_length(title) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index ai_conversations_user_idx on public.ai_conversations (user_id, updated_at desc);

call private.apply_owner_rls('ai_conversations');
call private.track_updated_at('ai_conversations');

-- Messages non modifiables : on peut lire, ajouter, ou supprimer (avec la conversation).
create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  conversation_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 20000),
  created_at timestamptz not null default now(),
  foreign key (conversation_id, user_id)
    references public.ai_conversations (id, user_id) on delete cascade
);
create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

call private.apply_owner_rls('ai_messages', array['select', 'insert', 'delete']);

-- Journal technique des appels IA : quotas par utilisateur et suivi des coûts.
-- Ne contient ni prompt ni réponse. L'utilisateur peut le lire et y ajouter
-- (via les actions serveur) mais ni le modifier ni le supprimer : un quota
-- ne peut donc pas être contourné en effaçant ses propres lignes.
create table public.ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  feature text not null check (
    feature in (
      'meal_photo', 'recipe', 'meal_plan', 'nutrition_coach',
      'training_program', 'exercise_swap', 'training_coach', 'weekly_review'
    )
  ),
  provider text not null check (char_length(provider) between 1 and 40),
  model text not null check (char_length(model) between 1 and 80),
  status text not null check (status in ('success', 'error', 'rejected')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  duration_ms integer check (duration_ms >= 0),
  created_at timestamptz not null default now()
);
create index ai_usage_log_quota_idx on public.ai_usage_log (user_id, feature, created_at desc);

call private.apply_owner_rls('ai_usage_log', array['select', 'insert']);
