import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
  Credenza,
  CredenzaBody,
  CredenzaClose,
  CredenzaContent,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/credenza";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  X,
  FileImage,
  FileVideo,
  Loader,
  ExternalLink,
  Upload,
} from "lucide-react";
import { trpc, queryClient } from "@/utils/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const defaultSystemPrompt =
  "You are an expert ad copywriter. Create compelling, persuasive ad copy that drives conversions. Focus on benefits, use emotional triggers, and include clear calls-to-action.";

// Step indicator component
function StepIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <div className="flex items-center justify-center mb-6">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <div key={index} className="flex items-center">
          <div
            className={cn(
              "w-4 h-4 rounded-full transition-all duration-300 ease-in-out",
              index <= currentStep ? "bg-primary" : "bg-primary/30",
              index < currentStep && "bg-primary"
            )}
          />
          {index < totalSteps - 1 && (
            <div
              className={cn(
                "w-8 h-0.5",
                index < currentStep ? "bg-primary" : "bg-primary/30"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function CreateProjectDialog({
  open,
  onOpenChange,
}: CreateProjectDialogProps) {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const totalSteps = 2;

  const {
    data: availableAssets = [],
    isLoading: assetsLoading,
    error: assetsError,
  } = useQuery(trpc.adCopy.getAvailableAssets.queryOptions());

  const createProjectMutation = useMutation(
    trpc.adCopy.createProject.mutationOptions({
      onSuccess: () => {
        toast.success("Project created successfully");
        // Invalidate and refetch projects list
        queryClient.invalidateQueries({
          queryKey: [["adCopy", "getProjects"]],
        });
        onOpenChange(false);
        form.reset();
        setCurrentStep(0);
        setSelectedAssets([]);
      },
      onError: (error) => {
        toast.error("Failed to create project: " + error.message);
      },
    })
  );

  const form = useForm({
    defaultValues: {
      name: "",
      landingPageUrls: [""],
      systemPrompt: defaultSystemPrompt,
      variationCount: 3,
    },
    onSubmit: async ({ value }) => {
      if (currentStep === 0) {
        // Validate each URL individually to provide specific feedback
        let hasErrors = false;

        // Validate name
        if (!value.name || value.name.trim() === "") {
          toast.error("Project name is required");
          hasErrors = true;
        }

        // Validate URLs individually
        const nonEmptyUrls = value.landingPageUrls.filter(
          (url) => url.trim() !== ""
        );
        if (nonEmptyUrls.length === 0) {
          toast.error("At least one landing page URL is required");
          hasErrors = true;
        } else {
          nonEmptyUrls.forEach((url, index) => {
            try {
              new URL(url);
            } catch {
              toast.error(`URL ${index + 1} is invalid: ${url}`);
              hasErrors = true;
            }
          });
        }

        // Validate system prompt
        if (!value.systemPrompt || value.systemPrompt.trim() === "") {
          toast.error("System prompt is required");
          hasErrors = true;
        }

        // Validate variation count
        if (value.variationCount < 1 || value.variationCount > 10) {
          toast.error("Variation count must be between 1 and 10");
          hasErrors = true;
        }

        if (hasErrors) {
          return;
        }

        setCurrentStep(1);
        return;
      }

      // Final submission
      createProjectMutation.mutate({
        ...value,
        landingPageUrls: value.landingPageUrls.filter(
          (url) => url.trim() !== ""
        ),
        assetIds: selectedAssets,
      });
    },
  });

  const addLandingPageUrl = () => {
    const currentUrls = form.getFieldValue("landingPageUrls");
    form.setFieldValue("landingPageUrls", [...currentUrls, ""]);
  };

  const removeLandingPageUrl = (index: number) => {
    const currentUrls = form.getFieldValue("landingPageUrls");
    if (currentUrls.length > 1) {
      form.setFieldValue(
        "landingPageUrls",
        currentUrls.filter((_, i) => i !== index)
      );
    }
  };

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssets((prev) =>
      prev.includes(assetId)
        ? prev.filter((id) => id !== assetId)
        : [...prev, assetId]
    );
  };

  const handleBack = () => {
    if (currentStep === 1) {
      setCurrentStep(0);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    form.reset();
    setCurrentStep(0);
    setSelectedAssets([]);
  };

  return (
    <Credenza open={open} onOpenChange={handleClose}>
      <CredenzaContent className="max-w-2xl">
        <CredenzaHeader>
          <CredenzaTitle>
            {currentStep === 0 ? "Create New Ad Copy Project" : "Select Assets"}
          </CredenzaTitle>
          <CredenzaDescription>
            {currentStep === 0
              ? "Set up your project details and landing pages"
              : "Choose the images and videos for your ad copy generation"}
          </CredenzaDescription>
        </CredenzaHeader>

        <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <CredenzaBody className="space-y-6">
            {currentStep === 0 ? (
              <>
                <div className="space-y-2">
                  <form.Field name="name">
                    {(field) => (
                      <div className="space-y-2">
                        <Label htmlFor={field.name}>Project Name</Label>
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Enter project name"
                        />
                        {field.state.meta.errors.map((error, index) => (
                          <p key={index} className="text-sm text-red-500">
                            {error}
                          </p>
                        ))}
                      </div>
                    )}
                  </form.Field>
                </div>

                <div className="space-y-2">
                  <Label>Landing Page URLs</Label>
                  <form.Field name="landingPageUrls">
                    {(field) => (
                      <div className="space-y-2">
                        {field.state.value.map((url, index) => (
                          <div
                            key={index}
                            className="flex items-center space-x-2"
                          >
                            <Input
                              value={url}
                              onChange={(e) => {
                                const newUrls = [...field.state.value];
                                newUrls[index] = e.target.value;
                                field.handleChange(newUrls);
                              }}
                              placeholder="https://example.com/landing-page"
                            />
                            {field.state.value.length > 1 && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => removeLandingPageUrl(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addLandingPageUrl}
                          className="w-full"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Another URL
                        </Button>
                        {field.state.meta.errors.map((error, index) => (
                          <p key={index} className="text-sm text-red-500">
                            {error}
                          </p>
                        ))}
                      </div>
                    )}
                  </form.Field>
                </div>

                <div className="space-y-2">
                  <form.Field name="variationCount">
                    {(field) => (
                      <div className="space-y-2">
                        <Label htmlFor={field.name}>Number of Variations</Label>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="number"
                          min="1"
                          max="10"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) =>
                            field.handleChange(parseInt(e.target.value) || 1)
                          }
                        />
                        {field.state.meta.errors.map((error, index) => (
                          <p key={index} className="text-sm text-red-500">
                            {error}
                          </p>
                        ))}
                      </div>
                    )}
                  </form.Field>
                </div>

                <div className="space-y-2">
                  <form.Field name="systemPrompt">
                    {(field) => (
                      <div className="space-y-2">
                        <Label htmlFor={field.name}>System Prompt</Label>
                        <Textarea
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Instructions for the AI copywriter..."
                          rows={4}
                        />
                        {field.state.meta.errors.map((error, index) => (
                          <p key={index} className="text-sm text-red-500">
                            {error}
                          </p>
                        ))}
                      </div>
                    )}
                  </form.Field>
                </div>
              </>
            ) : (
              <>
                {assetsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Loading assets...</span>
                  </div>
                ) : assetsError ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center text-red-600">
                        <Upload className="mr-2 h-5 w-5" />
                        Error Loading Assets
                      </CardTitle>
                      <CardDescription>
                        Failed to load assets from Dropbox:{" "}
                        {assetsError.message}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full" asChild>
                        <Link to="/integrations">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Check Integrations
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ) : availableAssets.length === 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Upload className="mr-2 h-5 w-5" />
                        No Assets Available
                      </CardTitle>
                      <CardDescription>
                        You need to connect your Dropbox account and have some
                        images or videos available.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full" asChild>
                        <Link to="/integrations">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Go to Integrations
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Select the images and videos you want to use for this
                      project:
                    </div>
                    <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                      {availableAssets.map((asset: any) => (
                        <Card
                          key={asset.id}
                          className={`cursor-pointer transition-colors ${
                            selectedAssets.includes(asset.id)
                              ? "ring-2 ring-primary bg-primary/5"
                              : "hover:bg-muted/50"
                          }`}
                          onClick={() => toggleAssetSelection(asset.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center space-x-3">
                              {asset.fileType === "image" ? (
                                <FileImage className="h-8 w-8 text-blue-500" />
                              ) : (
                                <FileVideo className="h-8 w-8 text-green-500" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {asset.fileName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {asset.fileType} •{" "}
                                  {(asset.fileSize / 1024 / 1024).toFixed(1)} MB
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    {selectedAssets.length > 0 && (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-muted-foreground">
                          Selected:
                        </span>
                        <Badge variant="secondary">
                          {selectedAssets.length} asset
                          {selectedAssets.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </CredenzaBody>

          <CredenzaFooter>
            <div className="flex items-center justify-between w-full mt-6">
              <div>
                {currentStep === 1 && (
                  <Button type="button" variant="outline" onClick={handleBack}>
                    Back
                  </Button>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <form.Subscribe>
                  {(state) => (
                    <Button
                      type="submit"
                      disabled={
                        state.isSubmitting ||
                        createProjectMutation.isPending ||
                        (currentStep === 1 && selectedAssets.length === 0)
                      }
                    >
                      {createProjectMutation.isPending ? (
                        <Loader className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {currentStep === 0 ? "Next" : "Create Project"}
                    </Button>
                  )}
                </form.Subscribe>
              </div>
            </div>
          </CredenzaFooter>
        </form>
      </CredenzaContent>
    </Credenza>
  );
}
