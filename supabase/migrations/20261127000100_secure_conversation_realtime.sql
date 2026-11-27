-- Private Realtime channels for conversation typing indicators.
-- Supabase enables RLS on realtime.messages; don't alter that managed setting.
-- Message bodies remain in public.messages and use their own RLS policies.

drop policy if exists "Conversation members receive typing signals" on realtime.messages;
create policy "Conversation members receive typing signals"
on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and exists (
    select 1
    from public.conversations c
    where realtime.topic() = 'conversation:' || c.id::text
      and public.can_send_in_conversation(c.id)
  )
);

drop policy if exists "Conversation members send typing signals" on realtime.messages;
create policy "Conversation members send typing signals"
on realtime.messages for insert to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and exists (
    select 1
    from public.conversations c
    where realtime.topic() = 'conversation:' || c.id::text
      and public.can_send_in_conversation(c.id)
  )
);
