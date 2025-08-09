import { ProtectedLayout } from "@/components/protected-layout";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const privateData = useQuery(trpc.privateData.queryOptions());

  return (
    <ProtectedLayout currentPage="Dashboard">
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <div className="bg-muted/50 aspect-video rounded-xl flex items-center justify-center">
          <h2 className="text-lg font-semibold">Welcome to Dashboard</h2>
        </div>
        <div className="bg-muted/50 aspect-video rounded-xl flex items-center justify-center">
          <p>Private Data: {privateData.data?.message}</p>
        </div>
        <div className="bg-muted/50 aspect-video rounded-xl flex items-center justify-center">
          <p>User: {privateData.data?.user?.name}</p>
        </div>
      </div>
      <div className="bg-muted/50 min-h-[200px] flex-1 rounded-xl md:min-h-min flex items-center justify-center">
        <p className="text-muted-foreground">Dashboard content goes here</p>
      </div>
    </ProtectedLayout>
  );
}
