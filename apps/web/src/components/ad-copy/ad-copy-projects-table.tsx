import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUpDown,
  Search,
  Eye,
  Edit,
  Trash2,
  Play,
  Loader2,
} from "lucide-react";
import { trpc } from "@/utils/trpc";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "@tanstack/react-router";
import { EditProjectDialog } from "./edit-project-dialog";

// Define the type based on what we expect from the API
type AdCopyProject = {
  id: string;
  name: string;
  platform: string;
  status: string;
  userId: string;
  variationCount: number;
  landingPageUrls: string[];
  systemPrompt: string;
  createdAt: string;
  updatedAt: string;
};

const statusColors = {
  draft: "bg-gray-100 text-gray-800",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

export function AdCopyProjectsTable() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const navigate = useNavigate();

  const {
    data: projects = [],
    isLoading,
    refetch,
  } = useQuery(trpc.adCopy.getProjects.queryOptions());

  const deleteProjectMutation = useMutation(
    trpc.adCopy.deleteProject.mutationOptions({
      onSuccess: () => {
        toast.success("Project deleted successfully");
        refetch();
      },
      onError: (error) => {
        toast.error("Failed to delete project: " + error.message);
      },
    })
  );

  const processAssetsMutation = useMutation(
    trpc.adCopy.processProjectAssets.mutationOptions()
  );

  const generateAdCopyMutation = useMutation(
    trpc.adCopy.generateAdCopy.mutationOptions({
      onSuccess: () => {
        toast.success("Ad copy generated successfully");
        refetch();
      },
      onError: (error) => {
        toast.error("Failed to start generation: " + error.message);
      },
    })
  );

  const handleGenerateAdCopy = async (projectId: string) => {
    try {
      // First, process assets
      toast.info("Processing assets...");
      await processAssetsMutation.mutateAsync({ projectId });

      // Then generate ad copy
      toast.info("Generating ad copy...");
      await generateAdCopyMutation.mutateAsync({ projectId });
    } catch (error) {
      // Error handling is done in individual mutations
      console.error("Error in ad copy generation flow:", error);
    }
  };

  const columns: ColumnDef<AdCopyProject>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Project Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("name")}</div>
      ),
    },
    {
      accessorKey: "platform",
      header: "Platform",
      cell: ({ row }) => {
        const platform = row.getValue("platform") as string;
        return (
          <Badge variant="outline" className="capitalize">
            {platform}
          </Badge>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge
            variant="secondary"
            className={statusColors[status as keyof typeof statusColors]}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "variationCount",
      header: "Variations",
      cell: ({ row }) => (
        <div className="text-center">{row.getValue("variationCount")}</div>
      ),
    },
    {
      accessorKey: "landingPageUrls",
      header: "Landing Pages",
      cell: ({ row }) => {
        const urls = row.getValue("landingPageUrls") as string[];
        return (
          <div className="text-sm text-muted-foreground">
            {urls.length} page{urls.length !== 1 ? "s" : ""}
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Created
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const date = row.getValue("createdAt") as string;
        return (
          <div className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(date), { addSuffix: true })}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      enableHiding: false,
      cell: ({ row }) => {
        const project = row.original;

        return (
          <div className="flex items-center space-x-2">
            {/* View Details */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      navigate({
                        to: "/ad-copy/$projectId",
                        params: { projectId: project.id },
                      })
                    }
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View details</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Edit Project */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditProjectId(project.id)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit project</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Generate Ad Copy (only for draft projects) */}
            {project.status === "draft" && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleGenerateAdCopy(project.id)}
                      disabled={
                        processAssetsMutation.isPending ||
                        generateAdCopyMutation.isPending
                      }
                    >
                      {processAssetsMutation.isPending ||
                      generateAdCopyMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Generate ad copy</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Delete Project */}
            <AlertDialog>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete project</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete
                    the project "{project.name}" and all associated data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      deleteProjectMutation.mutate({ id: project.id })
                    }
                    disabled={deleteProjectMutation.isPending}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {deleteProjectMutation.isPending ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: projects,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={globalFilter ?? ""}
            onChange={(event) => setGlobalFilter(String(event.target.value))}
            className="pl-8"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No projects found. Create your first ad copy project to get
                  started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} of{" "}
          {table.getCoreRowModel().rows.length} project(s)
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Edit Project Dialog */}
      {editProjectId && (
        <EditProjectDialog
          open={!!editProjectId}
          onOpenChange={(open) => {
            if (!open) setEditProjectId(null);
          }}
          projectId={editProjectId}
        />
      )}
    </div>
  );
}
