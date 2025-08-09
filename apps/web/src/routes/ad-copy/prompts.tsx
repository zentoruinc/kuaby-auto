import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { trpc, queryClient } from "@/utils/trpc";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { ProtectedLayout } from "@/components/protected-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, Eye, Settings } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Credenza,
  CredenzaBody,
  CredenzaContent,
  CredenzaDescription,
  CredenzaFooter,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/credenza";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/ad-copy/prompts")({
  component: PromptsRoute,
});

function PromptsRoute() {
  const [selectedPromptType, setSelectedPromptType] = useState("ad_copy");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

  const { data: templates = [], isLoading } = useQuery(
    trpc.promptTemplate.getAllTemplates.queryOptions({
      promptType: selectedPromptType,
    })
  );

  if (isLoading) {
    return (
      <ProtectedLayout
        currentPage="Prompt Templates"
        breadcrumbItems={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Ad Copy", href: "/ad-copy" },
          { label: "Prompt Templates" },
        ]}
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">
              Loading templates...
            </p>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout
      currentPage="Prompt Templates"
      breadcrumbItems={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Ad Copy", href: "/ad-copy" },
        { label: "Prompt Templates" },
      ]}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Prompt Templates</h1>
            <p className="text-muted-foreground">
              Manage and customize your AI prompt templates
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        </div>

        {/* Prompt Type Filter */}
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Prompt Type:</span>
          <Button
            variant={selectedPromptType === "ad_copy" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedPromptType("ad_copy")}
          >
            Ad Copy
          </Button>
          {/* Add more prompt types in the future */}
        </div>

        {/* Templates Table */}
        <Card>
          <CardHeader>
            <CardTitle>Templates</CardTitle>
            <CardDescription>
              {templates.length} template{templates.length !== 1 ? "s" : ""}{" "}
              found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <div className="text-center py-8">
                <Settings className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">
                  No templates found
                </h3>
                <p className="text-muted-foreground">
                  Create your first prompt template to get started.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Template
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sections</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">
                        {template.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {template.template.platform}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {template.promptType.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {template.isDefault ? (
                          <Badge variant="default">Default</Badge>
                        ) : (
                          <Badge variant="outline">Custom</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {template.template.sections.length} sections
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(
                            new Date((template as any).createdAt || Date.now()),
                            {
                              addSuffix: true,
                            }
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTemplate(template);
                                    setViewDialogOpen(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View template</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTemplate(template);
                                    setEditDialogOpen(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit template</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {!template.isDefault && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedTemplate(template);
                                      setDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Delete template</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Template Dialog */}
      <CreateTemplateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        promptType={selectedPromptType}
      />

      {/* View Template Dialog */}
      <ViewTemplateDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        template={selectedTemplate}
      />

      {/* Edit Template Dialog */}
      <EditTemplateDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        template={selectedTemplate}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteTemplateDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        template={selectedTemplate}
      />
    </ProtectedLayout>
  );
}

// Types for template management
interface PromptSection {
  id: string;
  name: string;
  content: string;
  editable: boolean;
  required: boolean;
  order: number;
}

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CreateTemplateDialogProps extends TemplateDialogProps {
  promptType: string;
}

interface TemplateWithDataProps extends TemplateDialogProps {
  template: any;
}

// Create Template Dialog Component
function CreateTemplateDialog({
  open,
  onOpenChange,
  promptType,
}: CreateTemplateDialogProps) {
  const form = useForm({
    defaultValues: {
      name: "",
      platform: "facebook",
      systemPrompt: "",
      sections: [] as PromptSection[],
    },
    onSubmit: async ({ value }) => {
      try {
        await createTemplateMutation.mutateAsync({
          name: value.name,
          platform: value.platform,
          systemPrompt: value.systemPrompt,
          sections: value.sections,
          promptType,
        });
      } catch (error) {
        // Error handling is done in the mutation
      }
    },
  });

  const createTemplateMutation = useMutation(
    trpc.promptTemplate.createTemplate.mutationOptions({
      onSuccess: () => {
        toast.success("Template created successfully");
        queryClient.invalidateQueries({
          queryKey: [["promptTemplate", "getAllTemplates"]],
        });
        onOpenChange(false);
        form.reset();
      },
      onError: (error) => {
        toast.error("Failed to create template: " + error.message);
      },
    })
  );

  const addSection = () => {
    const newSection: PromptSection = {
      id: `section_${Date.now()}`,
      name: "New Section",
      content: "",
      editable: true,
      required: false,
      order: form.state.values.sections.length + 1,
    };
    form.setFieldValue("sections", [...form.state.values.sections, newSection]);
  };

  const removeSection = (sectionId: string) => {
    form.setFieldValue(
      "sections",
      form.state.values.sections.filter((s) => s.id !== sectionId)
    );
  };

  const updateSection = (
    sectionId: string,
    updates: Partial<PromptSection>
  ) => {
    form.setFieldValue(
      "sections",
      form.state.values.sections.map((s) =>
        s.id === sectionId ? { ...s, ...updates } : s
      )
    );
  };

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="max-w-6xl">
        <CredenzaHeader>
          <CredenzaTitle>Create Prompt Template</CredenzaTitle>
          <CredenzaDescription>
            Create a new prompt template for {promptType.replace("_", " ")}
          </CredenzaDescription>
        </CredenzaHeader>

        <CredenzaBody>
          <ScrollArea className="h-[60vh] pr-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                form.handleSubmit();
              }}
              className="space-y-6"
            >
              {/* Template Name */}
              <form.Field name="name">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Template Name</Label>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Enter template name"
                      className={
                        field.state.meta.errors.length > 0
                          ? "border-red-500"
                          : ""
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

              {/* Platform Selection */}
              <form.Field name="platform">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Platform</Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="facebook">Facebook</SelectItem>
                        <SelectItem value="google">Google Ads</SelectItem>
                        <SelectItem value="tiktok">TikTok</SelectItem>
                      </SelectContent>
                    </Select>
                    {field.state.meta.errors.map((error, index) => (
                      <p key={index} className="text-sm text-red-500">
                        {error}
                      </p>
                    ))}
                  </div>
                )}
              </form.Field>

              {/* System Prompt */}
              <form.Field name="systemPrompt">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>System Prompt</Label>
                    <Textarea
                      id={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Base instructions for the AI..."
                      rows={3}
                      className={
                        field.state.meta.errors.length > 0
                          ? "border-red-500"
                          : ""
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

              {/* Sections */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Prompt Sections</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSection}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Section
                  </Button>
                </div>

                {form.state.values.sections.map((section) => (
                  <Card key={section.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <Input
                          value={section.name}
                          onChange={(e) =>
                            updateSection(section.id, { name: e.target.value })
                          }
                          className="font-medium"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSection(section.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Textarea
                        value={section.content}
                        onChange={(e) =>
                          updateSection(section.id, { content: e.target.value })
                        }
                        placeholder="Section content... Use {projectName}, {assetInterpretations}, {landingPageContent} as placeholders"
                        rows={4}
                      />
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={section.editable}
                            onChange={(e) =>
                              updateSection(section.id, {
                                editable: e.target.checked,
                              })
                            }
                          />
                          <span className="text-sm">User Editable</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={section.required}
                            onChange={(e) =>
                              updateSection(section.id, {
                                required: e.target.checked,
                              })
                            }
                          />
                          <span className="text-sm">Required</span>
                        </label>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </form>
          </ScrollArea>
        </CredenzaBody>

        <CredenzaFooter>
          <div className="flex items-center justify-end space-x-2 w-full">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createTemplateMutation.isPending}
              onClick={() => form.handleSubmit()}
            >
              {createTemplateMutation.isPending
                ? "Creating..."
                : "Create Template"}
            </Button>
          </div>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}

// View Template Dialog Component
function ViewTemplateDialog({
  open,
  onOpenChange,
  template,
}: TemplateWithDataProps) {
  if (!template) return null;

  // Build the full prompt for display
  const fullPrompt = React.useMemo(() => {
    if (!template) return "";

    const { systemPrompt, sections } = template.template;
    let prompt = systemPrompt + "\n\n";

    sections.forEach((section: any) => {
      prompt += `${section.name}:\n${section.content}\n\n`;
    });

    return prompt.trim();
  }, [template]);

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="max-w-6xl">
        <CredenzaHeader>
          <CredenzaTitle>{template.name}</CredenzaTitle>
          <CredenzaDescription>
            View template details for {template.template.platform}
          </CredenzaDescription>
        </CredenzaHeader>

        <CredenzaBody>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Template Info */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Platform</Label>
                  <Badge variant="outline" className="capitalize mt-1">
                    {template.template.platform}
                  </Badge>
                </div>
                <div>
                  <Label>Type</Label>
                  <Badge variant="secondary" className="capitalize mt-1">
                    {template.promptType.replace("_", " ")}
                  </Badge>
                </div>
                <div>
                  <Label>Status</Label>
                  {template.isDefault ? (
                    <Badge variant="default" className="mt-1">
                      Default
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="mt-1">
                      Custom
                    </Badge>
                  )}
                </div>
              </div>

              {/* Full Prompt Preview */}
              <div className="space-y-2">
                <Label>Complete Prompt Template</Label>
                <div className="bg-muted p-4 rounded-md border">
                  <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
                    {fullPrompt}
                  </pre>
                </div>
              </div>

              {/* Collapsible Section Details */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center space-x-2 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                    <Label className="cursor-pointer">
                      Section Details ({template.template.sections.length}{" "}
                      sections)
                    </Label>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 mt-4">
                  {template.template.sections.map((section: any) => (
                    <Card key={section.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            {section.name}
                          </CardTitle>
                          <div className="flex items-center space-x-2">
                            {section.editable && (
                              <Badge variant="outline" className="text-xs">
                                Editable
                              </Badge>
                            )}
                            {section.required && (
                              <Badge variant="destructive" className="text-xs">
                                Required
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-muted p-3 rounded-md">
                          <pre className="text-sm whitespace-pre-wrap">
                            {section.content}
                          </pre>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </ScrollArea>
        </CredenzaBody>

        <CredenzaFooter>
          <div className="flex items-center justify-end space-x-2 w-full">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}

// Edit Template Dialog Component
function EditTemplateDialog({
  open,
  onOpenChange,
  template,
}: TemplateWithDataProps) {
  const form = useForm({
    defaultValues: {
      name: template?.name || "",
      platform: template?.template?.platform || "facebook",
      systemPrompt: template?.template?.systemPrompt || "",
      sections: template?.template?.sections || [],
    },
    onSubmit: async ({ value }) => {
      try {
        await updateTemplateMutation.mutateAsync({
          id: template.id,
          name: value.name,
          platform: value.platform,
          systemPrompt: value.systemPrompt,
          sections: value.sections,
        });
      } catch (error) {
        // Error handling is done in the mutation
      }
    },
  });

  // Reset form when template changes
  React.useEffect(() => {
    if (template) {
      form.setFieldValue("name", template.name);
      form.setFieldValue("platform", template.template.platform);
      form.setFieldValue("systemPrompt", template.template.systemPrompt);
      form.setFieldValue("sections", template.template.sections);
    }
  }, [template, form]);

  const updateTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      // TODO: Implement when server is restarted with new endpoints
      console.log("Update template:", data);
      throw new Error(
        "Update functionality will be available after server restart"
      );
    },
    onSuccess: () => {
      toast.success("Template updated successfully");
      queryClient.invalidateQueries({
        queryKey: [["promptTemplate", "getAllTemplates"]],
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Failed to update template: " + error.message);
    },
  });

  const addSection = () => {
    const newSection: PromptSection = {
      id: `section_${Date.now()}`,
      name: "New Section",
      content: "",
      editable: true,
      required: false,
      order: form.state.values.sections.length + 1,
    };
    form.setFieldValue("sections", [...form.state.values.sections, newSection]);
  };

  const removeSection = (sectionId: string) => {
    form.setFieldValue(
      "sections",
      form.state.values.sections.filter((s: any) => s.id !== sectionId)
    );
  };

  const updateSection = (
    sectionId: string,
    updates: Partial<PromptSection>
  ) => {
    form.setFieldValue(
      "sections",
      form.state.values.sections.map((s: any) =>
        s.id === sectionId ? { ...s, ...updates } : s
      )
    );
  };

  if (!template) return null;

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="max-w-6xl">
        <CredenzaHeader>
          <CredenzaTitle>Edit Template</CredenzaTitle>
          <CredenzaDescription>
            Edit template: {template.name}
          </CredenzaDescription>
        </CredenzaHeader>

        <CredenzaBody>
          <ScrollArea className="h-[60vh] pr-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                form.handleSubmit();
              }}
              className="space-y-6"
            >
              {/* Template Name */}
              <form.Field name="name">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Template Name</Label>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Enter template name"
                      className={
                        field.state.meta.errors.length > 0
                          ? "border-red-500"
                          : ""
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

              {/* Platform Selection */}
              <form.Field name="platform">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Platform</Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="facebook">Facebook</SelectItem>
                        <SelectItem value="google">Google Ads</SelectItem>
                        <SelectItem value="tiktok">TikTok</SelectItem>
                      </SelectContent>
                    </Select>
                    {field.state.meta.errors.map((error, index) => (
                      <p key={index} className="text-sm text-red-500">
                        {error}
                      </p>
                    ))}
                  </div>
                )}
              </form.Field>

              {/* System Prompt */}
              <form.Field name="systemPrompt">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>System Prompt</Label>
                    <Textarea
                      id={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Base instructions for the AI..."
                      rows={3}
                      className={
                        field.state.meta.errors.length > 0
                          ? "border-red-500"
                          : ""
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

              {/* Sections */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Prompt Sections</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSection}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Section
                  </Button>
                </div>

                {form.state.values.sections.map((section: any) => (
                  <Card key={section.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <Input
                          value={section.name}
                          onChange={(e) =>
                            updateSection(section.id, { name: e.target.value })
                          }
                          className="font-medium"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSection(section.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Textarea
                        value={section.content}
                        onChange={(e) =>
                          updateSection(section.id, { content: e.target.value })
                        }
                        placeholder="Section content... Use {projectName}, {assetInterpretations}, {landingPageContent} as placeholders"
                        rows={4}
                      />
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={section.editable}
                            onChange={(e) =>
                              updateSection(section.id, {
                                editable: e.target.checked,
                              })
                            }
                          />
                          <span className="text-sm">User Editable</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={section.required}
                            onChange={(e) =>
                              updateSection(section.id, {
                                required: e.target.checked,
                              })
                            }
                          />
                          <span className="text-sm">Required</span>
                        </label>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </form>
          </ScrollArea>
        </CredenzaBody>

        <CredenzaFooter>
          <div className="flex items-center justify-end space-x-2 w-full">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateTemplateMutation.isPending}
              onClick={() => form.handleSubmit()}
            >
              {updateTemplateMutation.isPending
                ? "Updating..."
                : "Update Template"}
            </Button>
          </div>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
  );
}

// Delete Template Dialog Component
function DeleteTemplateDialog({
  open,
  onOpenChange,
  template,
}: TemplateWithDataProps) {
  const deleteTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      // TODO: Implement when server is restarted with new endpoints
      console.log("Delete template:", data);
      throw new Error(
        "Delete functionality will be available after server restart"
      );
    },
    onSuccess: () => {
      toast.success("Template deleted successfully");
      queryClient.invalidateQueries({
        queryKey: [["promptTemplate", "getAllTemplates"]],
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("Failed to delete template: " + error.message);
    },
  });

  const handleDelete = async () => {
    if (!template) return;

    try {
      await deleteTemplateMutation.mutateAsync({ id: template.id });
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  if (!template) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Template</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{template.name}"? This action
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteTemplateMutation.isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {deleteTemplateMutation.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
