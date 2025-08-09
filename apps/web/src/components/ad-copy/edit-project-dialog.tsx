import { useState } from "react";
import { useForm } from "@tanstack/react-form";
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
import { X, Plus, Save, Loader } from "lucide-react";
import { trpc, queryClient } from "@/utils/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function EditProjectDialog({
  open,
  onOpenChange,
  projectId,
}: EditProjectDialogProps) {
  const { data, isLoading } = useQuery({
    ...trpc.adCopy.getProject.queryOptions({ id: projectId }),
    enabled: open && !!projectId,
  });

  const updateProjectMutation = useMutation(
    trpc.adCopy.updateProject.mutationOptions({
      onSuccess: () => {
        toast.success("Project updated successfully");
        // Invalidate and refetch projects list and project details
        queryClient.invalidateQueries({
          queryKey: [["adCopy", "getProjects"]],
        });
        queryClient.invalidateQueries({
          queryKey: [["adCopy", "getProject"], { input: { id: projectId } }],
        });
        onOpenChange(false);
        form.reset();
      },
      onError: (error) => {
        toast.error("Failed to update project: " + error.message);
      },
    })
  );

  const form = useForm({
    defaultValues: {
      name: "",
      landingPageUrls: [""],
      variationCount: 3,
    },
    onSubmit: async ({ value }) => {
      updateProjectMutation.mutate({
        id: projectId,
        ...value,
        landingPageUrls: value.landingPageUrls.filter(
          (url) => url.trim() !== ""
        ),
      });
    },
  });

  // Update form when data loads
  if (data && !form.state.isSubmitted) {
    form.setFieldValue("name", data.project.name);
    form.setFieldValue(
      "landingPageUrls",
      data.project.landingPageUrls && data.project.landingPageUrls.length > 0
        ? data.project.landingPageUrls
        : [""]
    );

    form.setFieldValue("variationCount", data.project.variationCount);
  }

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

  const handleClose = () => {
    onOpenChange(false);
    form.reset();
  };

  if (isLoading) {
    return (
      <Credenza open={open} onOpenChange={onOpenChange}>
        <CredenzaContent className="max-w-2xl">
          <CredenzaHeader>
            <CredenzaTitle>Edit Project</CredenzaTitle>
            <CredenzaDescription>
              Loading project details...
            </CredenzaDescription>
          </CredenzaHeader>
          <CredenzaBody className="flex items-center justify-center py-8">
            <Loader className="h-8 w-8 animate-spin" />
          </CredenzaBody>
        </CredenzaContent>
      </Credenza>
    );
  }

  if (!data) {
    return (
      <Credenza open={open} onOpenChange={onOpenChange}>
        <CredenzaContent className="max-w-2xl">
          <CredenzaHeader>
            <CredenzaTitle>Edit Project</CredenzaTitle>
            <CredenzaDescription>
              Failed to load project details
            </CredenzaDescription>
          </CredenzaHeader>
          <CredenzaFooter>
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          </CredenzaFooter>
        </CredenzaContent>
      </Credenza>
    );
  }

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="max-w-2xl">
        <CredenzaHeader>
          <CredenzaTitle>Edit Project</CredenzaTitle>
          <CredenzaDescription>
            Update your project settings and configuration
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
            {/* Project Name */}
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

            {/* Landing Page URLs */}
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
                    {field.state.meta.errors.map((error, index) => (
                      <p key={index} className="text-sm text-red-500">
                        {error}
                      </p>
                    ))}
                  </div>
                )}
              </form.Field>
            </div>

            {/* Variation Count */}
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
          </CredenzaBody>

          <CredenzaFooter>
            <div className="flex items-center justify-end space-x-2 w-full">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateProjectMutation.isPending}>
                {updateProjectMutation.isPending ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </CredenzaFooter>
        </form>
      </CredenzaContent>
    </Credenza>
  );
}
