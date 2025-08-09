import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import {
  Credenza,
  CredenzaBody,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Save,
  Eye,
  Edit,
  Trash2,
  Settings,
  Loader,
  GripVertical,
} from "lucide-react";
import { trpc, queryClient } from "@/utils/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface PromptTemplateManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: "facebook" | "google" | "tiktok";
}

interface PromptSection {
  id: string;
  name: string;
  content: string;
  editable: boolean;
  required: boolean;
  order: number;
}

export function PromptTemplateManager({
  open,
  onOpenChange,
  platform,
}: PromptTemplateManagerProps) {
  const [currentView, setCurrentView] = useState<"list" | "create" | "edit">(
    "list"
  );
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [previewContext, setPreviewContext] = useState({
    projectName: "Sample Project",
    assetInterpretations: ["Sample asset interpretation"],
    landingPageContent: ["Sample landing page content"],
    variationCount: 3,
    variationType: "benefits",
  });

  // Get default template
  const { data: defaultTemplate } = useQuery({
    ...trpc.promptTemplate.getDefaultTemplate.queryOptions({ platform }),
    enabled: open,
  });

  // Get user templates
  const { data: userTemplates = [] } = useQuery({
    ...trpc.promptTemplate.getUserTemplates.queryOptions({ platform }),
    enabled: open,
  });

  // Create template mutation
  const createTemplateMutation = useMutation(
    trpc.promptTemplate.createTemplate.mutationOptions({
      onSuccess: () => {
        toast.success("Template created successfully");
        queryClient.invalidateQueries({
          queryKey: [["promptTemplate", "getUserTemplates"]],
        });
        setCurrentView("list");
        form.reset();
      },
      onError: (error) => {
        toast.error("Failed to create template: " + error.message);
      },
    })
  );

  const form = useForm({
    defaultValues: {
      name: "",
      systemPrompt: "",
      sections: [] as PromptSection[],
    },
    onSubmit: async ({ value }) => {
      createTemplateMutation.mutate({
        name: value.name,
        platform,
        systemPrompt: value.systemPrompt,
        sections: value.sections,
      });
    },
  });

  // Build prompt preview
  const { data: promptPreview, isLoading: previewLoading } = useQuery({
    ...trpc.promptTemplate.buildPromptPreview.queryOptions({
      platform,
      context: previewContext,
      sections: form.state.values.sections,
      systemPrompt: form.state.values.systemPrompt,
    }),
    enabled: currentView === "create" && form.state.values.sections?.length > 0,
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

  const loadDefaultTemplate = () => {
    if (defaultTemplate) {
      form.setFieldValue("name", `Custom ${platform} Template`);
      form.setFieldValue("systemPrompt", defaultTemplate.template.systemPrompt);
      form.setFieldValue("sections", defaultTemplate.template.sections);
    }
  };

  const renderListView = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Prompt Templates</h3>
        <Button onClick={() => setCurrentView("create")}>
          <Plus className="mr-2 h-4 w-4" />
          Create Template
        </Button>
      </div>

      {/* Default Template */}
      {defaultTemplate && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  {defaultTemplate.name}
                </CardTitle>
                <CardDescription>Default system template</CardDescription>
              </div>
              <Badge variant="secondary">Default</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">
              {defaultTemplate.template.sections.length} sections
            </p>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCurrentView("create");
                  loadDefaultTemplate();
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Customize
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Templates */}
      {userTemplates.map((template) => (
        <Card key={template.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{template.name}</CardTitle>
                <CardDescription>Custom template</CardDescription>
              </div>
              <Badge variant="outline">Custom</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">
              {template.template.sections.length} sections
            </p>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button variant="outline" size="sm">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderCreateView = () => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Create Prompt Template</h3>
        <Button
          type="button"
          variant="outline"
          onClick={() => setCurrentView("list")}
        >
          Back to List
        </Button>
      </div>

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
            />
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
            />
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

        {form.state.values.sections.map((section, index) => (
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
                  <X className="h-4 w-4" />
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
                      updateSection(section.id, { editable: e.target.checked })
                    }
                  />
                  <span className="text-sm">User Editable</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={section.required}
                    onChange={(e) =>
                      updateSection(section.id, { required: e.target.checked })
                    }
                  />
                  <span className="text-sm">Required</span>
                </label>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Preview */}
      {promptPreview && (
        <div className="space-y-2">
          <Label>Preview</Label>
          <div className="bg-muted p-4 rounded-md">
            <pre className="text-sm whitespace-pre-wrap">{promptPreview}</pre>
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setCurrentView("list")}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={createTemplateMutation.isPending}>
          {createTemplateMutation.isPending ? (
            <Loader className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Template
        </Button>
      </div>
    </form>
  );

  return (
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <CredenzaHeader>
          <CredenzaTitle>
            {platform.charAt(0).toUpperCase() + platform.slice(1)} Prompt
            Templates
          </CredenzaTitle>
          <CredenzaDescription>
            Manage and customize your ad copy generation prompts
          </CredenzaDescription>
        </CredenzaHeader>

        <CredenzaBody>
          {currentView === "list" && renderListView()}
          {currentView === "create" && renderCreateView()}
        </CredenzaBody>
      </CredenzaContent>
    </Credenza>
  );
}
