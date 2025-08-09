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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Plus, 
  X, 
  FileImage, 
  FileVideo, 
  Loader2,
  ExternalLink,
  Upload
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const defaultSystemPrompt = "You are an expert ad copywriter. Create compelling, persuasive ad copy that drives conversions. Focus on benefits, use emotional triggers, and include clear calls-to-action.";

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const [currentStep, setCurrentStep] = useState<"details" | "assets">("details");
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);

  const { data: availableAssets = [], isLoading: assetsLoading } = useQuery(
    trpc.adCopy.getAvailableAssets.queryOptions()
  );

  const createProjectMutation = useMutation(
    trpc.adCopy.createProject.mutationOptions({
      onSuccess: () => {
        toast.success("Project created successfully");
        onOpenChange(false);
        form.reset();
        setCurrentStep("details");
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
      if (currentStep === "details") {
        setCurrentStep("assets");
        return;
      }

      // Final submission
      createProjectMutation.mutate({
        ...value,
        landingPageUrls: value.landingPageUrls.filter(url => url.trim() !== ""),
        assetIds: selectedAssets,
      });
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(1, "Project name is required"),
        landingPageUrls: z.array(z.string().url("Invalid URL")).min(1, "At least one landing page URL is required"),
        systemPrompt: z.string().min(1, "System prompt is required"),
        variationCount: z.number().min(1, "Must generate at least 1 variation").max(10, "Maximum 10 variations allowed"),
      }),
    },
  });

  const addLandingPageUrl = () => {
    const currentUrls = form.getFieldValue("landingPageUrls");
    form.setFieldValue("landingPageUrls", [...currentUrls, ""]);
  };

  const removeLandingPageUrl = (index: number) => {
    const currentUrls = form.getFieldValue("landingPageUrls");
    if (currentUrls.length > 1) {
      form.setFieldValue("landingPageUrls", currentUrls.filter((_, i) => i !== index));
    }
  };

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssets(prev => 
      prev.includes(assetId) 
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    );
  };

  const handleBack = () => {
    if (currentStep === "assets") {
      setCurrentStep("details");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    form.reset();
    setCurrentStep("details");
    setSelectedAssets([]);
  };

  return (
    <Credenza open={open} onOpenChange={handleClose}>
      <CredenzaContent className="max-w-2xl">
        <CredenzaHeader>
          <CredenzaTitle>
            {currentStep === "details" ? "Create New Ad Copy Project" : "Select Assets"}
          </CredenzaTitle>
          <CredenzaDescription>
            {currentStep === "details" 
              ? "Set up your project details and landing pages"
              : "Choose the images and videos for your ad copy generation"
            }
          </CredenzaDescription>
        </CredenzaHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <CredenzaBody className="space-y-6">
            {currentStep === "details" ? (
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
                        {field.state.meta.errors.map((error) => (
                          <p key={error?.message} className="text-sm text-red-500">
                            {error?.message}
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
                          <div key={index} className="flex items-center space-x-2">
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
                        {field.state.meta.errors.map((error) => (
                          <p key={error?.message} className="text-sm text-red-500">
                            {error?.message}
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
                          onChange={(e) => field.handleChange(parseInt(e.target.value) || 1)}
                        />
                        {field.state.meta.errors.map((error) => (
                          <p key={error?.message} className="text-sm text-red-500">
                            {error?.message}
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
                        {field.state.meta.errors.map((error) => (
                          <p key={error?.message} className="text-sm text-red-500">
                            {error?.message}
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
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Loading assets...</span>
                  </div>
                ) : availableAssets.length === 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Upload className="mr-2 h-5 w-5" />
                        No Assets Available
                      </CardTitle>
                      <CardDescription>
                        You need to connect your Dropbox account and have some images or videos available.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Go to Integrations
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Select the images and videos you want to use for this project:
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
                                  {asset.fileType} • {(asset.fileSize / 1024 / 1024).toFixed(1)} MB
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    {selectedAssets.length > 0 && (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-muted-foreground">Selected:</span>
                        <Badge variant="secondary">
                          {selectedAssets.length} asset{selectedAssets.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </CredenzaBody>

          <CredenzaFooter>
            <div className="flex items-center justify-between w-full">
              <div>
                {currentStep === "assets" && (
                  <Button type="button" variant="outline" onClick={handleBack}>
                    Back
                  </Button>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <CredenzaClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </CredenzaClose>
                <form.Subscribe>
                  {(state) => (
                    <Button
                      type="submit"
                      disabled={
                        !state.canSubmit || 
                        state.isSubmitting || 
                        createProjectMutation.isPending ||
                        (currentStep === "assets" && selectedAssets.length === 0)
                      }
                    >
                      {createProjectMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {currentStep === "details" ? "Next" : "Create Project"}
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
