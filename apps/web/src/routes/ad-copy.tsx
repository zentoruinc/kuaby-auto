import { Button } from "@/components/ui/button";
import { ProtectedLayout } from "@/components/protected-layout";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { AdCopyProjectsTable } from "@/components/ad-copy/ad-copy-projects-table";
import { CreateProjectDialog } from "@/components/ad-copy/create-project-dialog";

export const Route = createFileRoute("/ad-copy")({
  component: AdCopyRoute,
});

function AdCopyRoute() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  return (
    <ProtectedLayout
      currentPage="Ad Copy"
      breadcrumbItems={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Ad Copy" },
      ]}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Ad Copy Projects</h1>
            <p className="text-muted-foreground">
              Create and manage AI-powered ad copy campaigns using your assets and landing pages.
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </div>

        <AdCopyProjectsTable />

        <CreateProjectDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
        />
      </div>
    </ProtectedLayout>
  );
}
