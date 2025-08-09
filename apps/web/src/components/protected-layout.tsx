import React from "react";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuthProtection } from "@/hooks/useAuthProtection";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

interface ProtectedLayoutProps {
  children: React.ReactNode;
  breadcrumbItems?: {
    label: string;
    href?: string;
  }[];
  currentPage: string;
  className?: string;
}

export function ProtectedLayout({
  children,
  breadcrumbItems = [],
  currentPage,
  className = "p-4",
}: ProtectedLayoutProps) {
  const { session, isPending } = useAuthProtection();

  if (isPending) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <div>Redirecting...</div>;
  }

  return (
    <SidebarProvider>
      <AppSidebar
        user={{
          name: session.user.name || "User",
          email: session.user.email || "user@kuaby.com",
          avatar: session.user.image || "/avatars/user.jpg",
        }}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b">
          <div className="flex items-center gap-2 px-3">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbItems.map((item, index) => (
                  <React.Fragment key={index}>
                    <BreadcrumbItem className="hidden md:block">
                      {item.href ? (
                        <BreadcrumbLink asChild>
                          <Link to={item.href}>{item.label}</Link>
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage>{item.label}</BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                    {index < breadcrumbItems.length - 1 && (
                      <BreadcrumbSeparator className="hidden md:block" />
                    )}
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className={cn("flex flex-1 flex-col gap-4", className)}>
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
