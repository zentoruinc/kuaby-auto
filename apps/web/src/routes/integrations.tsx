import { ProtectedLayout } from "@/components/protected-layout";
import { trpc } from "@/utils/trpc";
import { useQuery, useMutation } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/integrations")({
  component: RouteComponent,
});

function RouteComponent() {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);

  const connectedIntegrationsQuery = useQuery(
    trpc.integration.getConnectedIntegrations.queryOptions()
  );

  const dropboxAuthUrlQuery = useQuery({
    ...trpc.integration.getDropboxAuthUrl.queryOptions(),
    enabled: false, // Only fetch when needed
  });

  const handleDropboxCallbackMutation = useMutation(
    trpc.integration.handleDropboxCallback.mutationOptions({
      onSuccess: () => {
        toast.success("Dropbox connected successfully!");
        connectedIntegrationsQuery.refetch();
        setIsConnecting(false);
      },
      onError: (error) => {
        toast.error(`Failed to connect Dropbox: ${error.message}`);
        setIsConnecting(false);
      },
    })
  );

  const disconnectIntegrationMutation = useMutation(
    trpc.integration.disconnectIntegration.mutationOptions({
      onSuccess: () => {
        toast.success("Integration disconnected successfully!");
        connectedIntegrationsQuery.refetch();
      },
      onError: (error) => {
        toast.error(`Failed to disconnect integration: ${error.message}`);
      },
    })
  );

  // Handle OAuth callback from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    const error = urlParams.get("error");

    if (error) {
      toast.error(`OAuth error: ${error}`);
      // Clean up URL
      router.navigate({ to: "/integrations" });
      return;
    }

    if (code && state) {
      setIsConnecting(true);
      handleDropboxCallbackMutation.mutate({ code, state });
      // Clean up URL
      router.navigate({ to: "/integrations" });
    }
  }, []);

  const handleConnectDropbox = async () => {
    try {
      setIsConnecting(true);
      const authData = await dropboxAuthUrlQuery.refetch();
      if (authData.data) {
        // Redirect to Dropbox OAuth
        window.location.href = authData.data.authUrl;
      }
    } catch (error) {
      toast.error("Failed to initiate Dropbox connection");
      setIsConnecting(false);
    }
  };

  const handleDisconnectDropbox = (integrationId: string) => {
    disconnectIntegrationMutation.mutate({ integrationId });
  };

  const dropboxIntegrations =
    connectedIntegrationsQuery.data?.filter(
      (integration: any) => integration.provider === "dropbox"
    ) || [];

  return (
    <ProtectedLayout
      currentPage="Integrations"
      breadcrumbItems={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Integrations" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground">
            Connect your external accounts to automate workflows
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Dropbox Integration Card */}
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="p-6">
              <div className="flex items-center space-x-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                  <svg
                    className="h-6 w-6 text-blue-600"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M6 2L12 6L6 10L0 6L6 2ZM18 2L24 6L18 10L12 6L18 2ZM0 14L6 10L12 14L6 18L0 14ZM12 14L18 10L24 14L18 18L12 14ZM6 22L12 18L18 22L12 26L6 22Z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold">Dropbox</h3>
                  <p className="text-sm text-muted-foreground">
                    Cloud file storage and sharing
                  </p>
                </div>
              </div>

              <div className="mt-4">
                {dropboxIntegrations.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-green-600">
                      <svg
                        className="mr-2 h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Connected ({dropboxIntegrations.length})
                    </div>
                    {dropboxIntegrations.map((integration: any) => (
                      <div
                        key={integration.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-muted-foreground">
                          {integration.accountEmail}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleDisconnectDropbox(integration.id)
                          }
                          disabled={disconnectIntegrationMutation.isPending}
                          className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                        >
                          Disconnect
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Not connected
                  </div>
                )}
              </div>

              <div className="mt-4">
                <Button
                  onClick={handleConnectDropbox}
                  disabled={isConnecting || dropboxAuthUrlQuery.isFetching}
                  className="w-full"
                >
                  {isConnecting ? "Connecting..." : "Connect Dropbox"}
                </Button>
              </div>
            </div>
          </div>

          {/* Placeholder for future integrations */}
          <div className="rounded-lg border border-dashed bg-muted/50 text-muted-foreground">
            <div className="p-6 text-center">
              <div className="mx-auto h-12 w-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <h3 className="font-medium mb-2">
                More integrations coming soon
              </h3>
              <p className="text-sm">
                We're working on adding more integrations to help automate your
                workflows.
              </p>
            </div>
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
