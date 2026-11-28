// Example page for the current manager's cabinet.
// Adjust the two imports marked TODO to match your project.
import { redirect } from 'next/navigation';
import TrophyCabinet from '@/components/trophy-cabinet/TrophyCabinet';
import { fetchManagerTrophies } from '@/lib/trophies/queries';
import { createClient } from '@/lib/supabase/server'; // TODO: your server-side Supabase helper

export default async function TrophiesPage() {
  const supabase = await createClient(); // TODO: remove `await` if your helper is not async
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login'); // TODO: your login route

  const wins = await fetchManagerTrophies(supabase, user.id);

  return (
    <TrophyCabinet
      managerName={(user.user_metadata?.manager_name as string | undefined) ?? 'Manager'} // TODO: where you keep the manager's name
      avatarUrl={(user.user_metadata?.avatar_url as string | undefined) ?? null}
      wins={wins}
    />
  );
}
