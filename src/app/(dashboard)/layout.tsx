import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { SidebarProvider } from "@/contexts/SidebarContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
