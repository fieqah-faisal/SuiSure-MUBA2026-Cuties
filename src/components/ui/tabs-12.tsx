import type { LucideIcon } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface Tabs12Service {
  name: string;
  value: string;
  icon: LucideIcon;
  content: React.ReactNode;
}

interface Tabs12Props {
  value: string;
  onValueChange: (value: string) => void;
  services: Tabs12Service[];
  className?: string;
}

export function Tabs12({ value, onValueChange, services, className }: Tabs12Props) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => next && onValueChange(next)}
      className={cn("w-full", className)}
    >
      <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1">
        {services.map(({ icon: Icon, name, value: tabValue }) => {
          const active = value === tabValue;
          return (
            <TabsTrigger
              key={tabValue}
              value={tabValue}
              className={cn(
                "group flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-bold uppercase tracking-wide transition-all",
                "text-muted-foreground hover:bg-muted hover:text-foreground",
                "data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-primary/30",
              )}
            >
              <Icon
                className={cn(
                  "h-3.5 w-3.5 transition-colors",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                )}
                strokeWidth={active ? 2.5 : 2}
              />
              <span>{name}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {services.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-4 focus-visible:outline-none">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
