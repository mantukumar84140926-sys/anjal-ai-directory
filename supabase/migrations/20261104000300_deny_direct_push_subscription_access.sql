create policy "Deny direct browser access to push subscriptions"
on public.push_subscriptions
for all
to anon, authenticated
using (false)
with check (false);
