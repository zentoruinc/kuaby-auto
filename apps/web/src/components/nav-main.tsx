"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon: LucideIcon;
    isActive?: boolean;
    items?: {
      title: string;
      url: string;
    }[];
  }[];
}) {
  // State to track which items are expanded
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(
    {}
  );

  // Load expanded state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-expanded-items");
    if (saved) {
      try {
        setExpandedItems(JSON.parse(saved));
      } catch (e) {
        // Ignore invalid JSON
      }
    }
  }, []);

  // Save expanded state to localStorage
  const toggleExpanded = (itemTitle: string, isOpen: boolean) => {
    const newExpandedItems = { ...expandedItems, [itemTitle]: isOpen };
    setExpandedItems(newExpandedItems);
    localStorage.setItem(
      "sidebar-expanded-items",
      JSON.stringify(newExpandedItems)
    );
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const isExpanded =
            expandedItems[item.title] ?? item.isActive ?? false;

          return (
            <Collapsible
              key={item.title}
              asChild
              open={isExpanded}
              onOpenChange={(open) => toggleExpanded(item.title, open)}
            >
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={item.title}>
                  <Link to={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
                {item.items?.length ? (
                  <>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuAction className="data-[state=open]:rotate-90">
                        <ChevronRight />
                        <span className="sr-only">Toggle</span>
                      </SidebarMenuAction>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items?.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton asChild>
                              <Link to={subItem.url}>
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </>
                ) : null}
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
