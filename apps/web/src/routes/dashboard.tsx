import { useAuthProtection } from "@/hooks/useAuthProtection";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const { session, isPending } = useAuthProtection();
  const privateData = useQuery(trpc.privateData.queryOptions());

  if (isPending) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <div>Redirecting...</div>;
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome {session.user.name}</p>
      <p>privateData: {privateData.data?.message}</p>
    </div>
  );
}
