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

import {
  ArrowLeft,
  FileImage,
  FileVideo,
  Globe,
  Loader2,
  ChevronDown,
  ChevronRight,
  Eye,
  Copy,
  Download,
  ExternalLink,
  Calendar,
  Clock,
  User,
  Settings,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";

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
  const [expandedSections, setExpandedSections] = useState({
    projectInfo: true,
    landingPages: true,
    assets: true,
    generations: true,
    metadata: false,
  });

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
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
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
  const landingPageMetadata = (data as any).landingPageMetadata;

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
        </div>

        {/* Project Details */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Basic Info */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                Project Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center">
                    <User className="mr-1 h-3 w-3" />
                    Platform
                  </label>
                  <Badge variant="outline" className="mt-1 capitalize">
                    {project.platform}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Variations
                  </label>
                  <p className="text-sm font-medium">
                    {project.variationCount}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center">
                    <Calendar className="mr-1 h-3 w-3" />
                    Created
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(project.createdAt))} ago
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center">
                    <Clock className="mr-1 h-3 w-3" />
                    Updated
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(project.updatedAt))} ago
                  </p>
                </div>
              </div>

              {/* System Prompt */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  System Prompt
                </label>
                <ScrollArea className="h-32 mt-2">
                  <div className="bg-muted p-3 rounded-md">
                    <pre className="text-sm whitespace-pre-wrap font-mono">
                      {project.systemPrompt}
                    </pre>
                  </div>
                </ScrollArea>
              </div>

              {/* Landing Page Metadata */}
              <Collapsible
                open={expandedSections.metadata}
                onOpenChange={(open) =>
                  setExpandedSections((prev) => ({ ...prev, metadata: open }))
                }
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center space-x-2 p-0"
                  >
                    {expandedSections.metadata ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="text-sm font-medium">
                      Landing Page Metadata ({project.landingPageUrls.length}{" "}
                      pages)
                    </span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 mt-3">
                  {landingPageMetadata?.map((pageData: any, index: number) => {
                    const metadata = pageData.metadata;
                    return (
                      <Card key={index} className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              Page {index + 1}
                            </span>
                          </div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" asChild>
                                  <a
                                    href={pageData.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Open in new tab</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <p className="text-xs text-blue-600 hover:underline truncate mb-3">
                          {pageData.url}
                        </p>

                        {metadata ? (
                          <div className="space-y-2">
                            {metadata.title && (
                              <div>
                                <span className="text-xs font-medium text-muted-foreground">
                                  Title:
                                </span>
                                <p className="text-xs">{metadata.title}</p>
                              </div>
                            )}
                            {metadata.metadata?.description && (
                              <div>
                                <span className="text-xs font-medium text-muted-foreground">
                                  Description:
                                </span>
                                <p className="text-xs">
                                  {metadata.metadata.description}
                                </p>
                              </div>
                            )}
                            {metadata.metadata?.keywords &&
                              metadata.metadata.keywords.length > 0 && (
                                <div>
                                  <span className="text-xs font-medium text-muted-foreground">
                                    Keywords:
                                  </span>
                                  <p className="text-xs">
                                    {metadata.metadata.keywords.join(", ")}
                                  </p>
                                </div>
                              )}
                            <div>
                              <span className="text-xs font-medium text-muted-foreground">
                                Scraped:
                              </span>
                              <p className="text-xs">
                                {formatDistanceToNow(
                                  new Date(metadata.createdAt)
                                )}{" "}
                                ago
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            <p>No metadata available - page not yet scraped</p>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {generations.length}
                </div>
                <p className="text-sm text-muted-foreground">
                  Generated Copies
                </p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {assets.length}
                </div>
                <p className="text-sm text-muted-foreground">Assets</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {project.landingPageUrls.length}
                </div>
                <p className="text-sm text-muted-foreground">Landing Pages</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Assets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileImage className="mr-2 h-4 w-4" />
              Assets ({assets.length})
            </CardTitle>
            <CardDescription>
              Images and videos used for this project with AI interpretations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assets.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No assets selected for this project
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assets.map((asset) => (
                  <Card key={asset.id} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        {asset.fileType === "image" ? (
                          <FileImage className="h-5 w-5 text-blue-500" />
                        ) : (
                          <FileVideo className="h-5 w-5 text-green-500" />
                        )}
                        <span className="text-sm font-medium truncate">
                          {asset.fileName}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>View asset</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Download className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Download asset</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          Size: {(asset.fileSize / 1024 / 1024).toFixed(1)} MB
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {asset.fileType}
                        </Badge>
                      </div>

                      {/* Asset Interpretation */}
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="flex items-center space-x-2 p-0 h-auto"
                          >
                            <ChevronRight className="h-3 w-3" />
                            <span className="text-xs font-medium">
                              AI Interpretation
                            </span>
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <div className="bg-muted p-2 rounded-md">
                            {(asset as any).interpretation ? (
                              <div className="space-y-2">
                                <p className="text-xs">
                                  {(asset as any).interpretation.interpretation}
                                </p>
                                <div className="text-xs text-muted-foreground">
                                  <p>
                                    Method:{" "}
                                    {
                                      (asset as any).interpretation
                                        .processingMethod
                                    }
                                  </p>
                                  <p>
                                    Processed:{" "}
                                    {formatDistanceToNow(
                                      new Date(
                                        (asset as any).interpretation.createdAt
                                      )
                                    )}{" "}
                                    ago
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                No AI interpretation available - asset not yet
                                processed
                              </p>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Generated Ad Copy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Copy className="mr-2 h-4 w-4" />
              Generated Ad Copy ({generations.length})
            </CardTitle>
            <CardDescription>
              AI-generated ad copy variations with metadata
            </CardDescription>
          </CardHeader>
          <CardContent>
            {generations.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No ad copy generated yet
              </p>
            ) : (
              <div className="space-y-6">
                {generations.map((generation) => (
                  <Card key={generation.id} className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium">
                          Variation {generation.variationNumber}
                        </h4>
                        <Badge
                          variant="secondary"
                          className="text-xs capitalize"
                        >
                          {generation.platform}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {generation.variationType?.replace("_", " ")}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {formatDistanceToNow(new Date(generation.createdAt))}{" "}
                          ago
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Copy className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Copy to clipboard</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Download className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Export copy</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {/* Facebook Format */}
                      {generation.content?.facebook && (
                        <>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Headline
                            </label>
                            <p className="text-sm font-medium">
                              {generation.content.facebook.headline}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Primary Text
                            </label>
                            <p className="text-sm whitespace-pre-wrap">
                              {generation.content.facebook.primaryText}
                            </p>
                          </div>
                        </>
                      )}

                      {/* Google Format */}
                      {generation.content?.google && (
                        <>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Headline
                            </label>
                            <p className="text-sm font-medium">
                              {generation.content.google.headline}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Description 1
                            </label>
                            <p className="text-sm">
                              {generation.content.google.description1}
                            </p>
                          </div>
                          {generation.content.google.description2 && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">
                                Description 2
                              </label>
                              <p className="text-sm">
                                {generation.content.google.description2}
                              </p>
                            </div>
                          )}
                        </>
                      )}

                      {/* TikTok Format */}
                      {generation.content?.tiktok && (
                        <>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Caption
                            </label>
                            <p className="text-sm whitespace-pre-wrap">
                              {generation.content.tiktok.caption}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Hashtags
                            </label>
                            <p className="text-sm">
                              {generation.content.tiktok.hashtags.join(" ")}
                            </p>
                          </div>
                        </>
                      )}

                      {/* No content available */}
                      {!generation.content?.facebook &&
                        !generation.content?.google &&
                        !generation.content?.tiktok && (
                          <div className="text-center py-4 text-muted-foreground">
                            <p>No content available for this variation</p>
                          </div>
                        )}

                      {/* Generation Metadata */}
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="flex items-center space-x-2 p-0 mt-3"
                          >
                            <ChevronRight className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              Generation Metadata
                            </span>
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                          <div className="bg-muted p-3 rounded-md space-y-3">
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <span className="font-medium">Generated:</span>
                                <p className="text-muted-foreground">
                                  {formatDistanceToNow(
                                    new Date(generation.createdAt)
                                  )}{" "}
                                  ago
                                </p>
                              </div>
                              <div>
                                <span className="font-medium">
                                  Variation Type:
                                </span>
                                <p className="text-muted-foreground">
                                  {generation.variationType?.replace(
                                    "_",
                                    " "
                                  ) || "Standard"}
                                </p>
                              </div>
                            </div>

                            {/* Generation Metadata */}
                            {generation.generationMetadata && (
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div>
                                    <span className="font-medium">Model:</span>
                                    <p className="text-muted-foreground">
                                      {generation.generationMetadata.model}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="font-medium">
                                      Temperature:
                                    </span>
                                    <p className="text-muted-foreground">
                                      {
                                        generation.generationMetadata
                                          .temperature
                                      }
                                    </p>
                                  </div>
                                  <div>
                                    <span className="font-medium">Tokens:</span>
                                    <p className="text-muted-foreground">
                                      {generation.generationMetadata.tokens}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="font-medium">
                                      Processing Time:
                                    </span>
                                    <p className="text-muted-foreground">
                                      {
                                        generation.generationMetadata
                                          .processingTime
                                      }
                                      ms
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Context Information */}
                            <Collapsible>
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="flex items-center space-x-2 p-0 h-auto"
                                >
                                  <ChevronRight className="h-3 w-3" />
                                  <span className="text-xs font-medium">
                                    Context & Prompt
                                  </span>
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="mt-2">
                                <div className="space-y-2">
                                  <div>
                                    <span className="text-xs font-medium">
                                      Final Prompt:
                                    </span>
                                    <div className="bg-background p-2 rounded border mt-1">
                                      <pre className="text-xs whitespace-pre-wrap font-mono">
                                        {generation.finalPrompt}
                                      </pre>
                                    </div>
                                  </div>
                                  {generation.context && (
                                    <div>
                                      <span className="text-xs font-medium">
                                        Context:
                                      </span>
                                      <div className="bg-background p-2 rounded border mt-1">
                                        <div className="text-xs space-y-1">
                                          <p>
                                            <strong>Assets:</strong>{" "}
                                            {generation.context
                                              .assetInterpretations?.length ||
                                              0}{" "}
                                            interpretations
                                          </p>
                                          <p>
                                            <strong>Landing Pages:</strong>{" "}
                                            {generation.context
                                              .landingPageContent?.length ||
                                              0}{" "}
                                            pages
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedLayout>
  );
}
