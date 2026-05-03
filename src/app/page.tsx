import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Middleware handles this too, but belt-and-braces
  if (user) redirect('/dashboard')
  redirect('/auth/signin')
}
