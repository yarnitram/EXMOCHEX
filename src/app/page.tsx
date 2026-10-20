import { createClient } from "@/lib/supabase/server";
import { LandingPage } from "@/components/landing/landing-page";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home(props: {
  searchParams?: Promise<{ code?: string; next?: string }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  if (searchParams?.code) {
    const nextPath = searchParams.next || "/watchlist";
    redirect(`/auth/callback?code=${encodeURIComponent(searchParams.code)}&next=${encodeURIComponent(nextPath)}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <LandingPage user={user ? { email: user.email || "" } : null} />;
}
