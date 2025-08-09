import { ProtectedLayout } from "@/components/protected-layout";
import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ArrowLeft, FileImage, FileVideo, Globe, Loader } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/ad-copy/$projectId")({
  component: ProjectDetailsRoute,
});

const statusColors = {
  draft: "bg-gray-100 text-gray-800",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

function ProjectDetailsRoute() {
  const { projectId } = Route.useParams();

  const { data, isLoading, error } = useQuery(
    trpc.adCopy.getProject.queryOptions({ id: projectId })
  );

  if (isLoading) {
    return (
      <ProtectedLayout
        currentPage="Project Details"
        breadcrumbItems={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Ad Copy", href: "/ad-copy" },
          { label: "Loading..." },
        ]}
      >
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <Loader className="h-8 w-8 animate-spin mx-auto" />
            <p className="mt-2 text-muted-foreground">Loading project...</p>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  if (error || !data) {
    return (
      <ProtectedLayout
        currentPage="Project Details"
        breadcrumbItems={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Ad Copy", href: "/ad-copy" },
          { label: "Error" },
        ]}
      >
        <div className="text-center py-8">
          <p className="text-red-600">Failed to load project details</p>
          <Button asChild className="mt-4">
            <Link to="/ad-copy">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Projects
            </Link>
          </Button>
        </div>
      </ProtectedLayout>
    );
  }

  const { project, assets, generations } = data;

  return (
    <ProtectedLayout
      currentPage={project.name}
      breadcrumbItems={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Ad Copy", href: "/ad-copy" },
        { label: project.name },
      ]}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/ad-copy">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {project.name}
              </h1>
              <div className="flex items-center space-x-2 mt-1">
                <Badge
                  variant="secondary"
                  className={
                    statusColors[project.status as keyof typeof statusColors]
                  }
                >
                  {project.status.charAt(0).toUpperCase() +
                    project.status.slice(1)}
                </Badge>
                <span className="text-muted-foreground">
                  Created {formatDistanceToNow(new Date(project.createdAt))} ago
                </span>
              </div>
            </div>
          </div>
          <Button asChild>
            <Link to="/ad-copy">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Projects
            </Link>
          </Button>
        </div>

        {/* Project Details */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Variations
                </label>
                <p className="text-sm">{project.variationCount} variations</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  System Prompt
                </label>
                <p className="text-sm bg-muted p-3 rounded-md">
                  {project.systemPrompt}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Landing Pages */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Globe className="mr-2 h-4 w-4" />
                Landing Pages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {project.landingPageUrls.map((url, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline truncate"
                    >
                      {url}
                    </a>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Assets */}
        <Card>
          <CardHeader>
            <CardTitle>Assets ({assets.length})</CardTitle>
            <CardDescription>
              Images and videos used for this project
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assets.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No assets selected
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {assets.map((asset) => (
                  <div key={asset.id} className="border rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      {asset.fileType === "image" ? (
                        <FileImage className="h-4 w-4 text-blue-500" />
                      ) : (
                        <FileVideo className="h-4 w-4 text-green-500" />
                      )}
                      <span className="text-sm font-medium truncate">
                        {asset.fileName}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(asset.fileSize / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Generated Ad Copy */}
        <Card>
          <CardHeader>
            <CardTitle>Generated Ad Copy ({generations.length})</CardTitle>
            <CardDescription>AI-generated ad copy variations</CardDescription>
          </CardHeader>
          <CardContent>
            {generations.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No ad copy generated yet
              </p>
            ) : (
              <div className="space-y-6">
                {generations.map((generation) => (
                  <div key={generation.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">
                        Variation {generation.variationNumber}
                      </h4>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">
                          Headline
                        </label>
                        <p className="text-sm font-medium">
                          {generation.headline}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">
                          Body
                        </label>
                        <p className="text-sm">{generation.body}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">
                          Call to Action
                        </label>
                        <p className="text-sm font-medium">
                          {generation.callToAction}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedLayout>
  );
}
