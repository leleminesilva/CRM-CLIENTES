import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { DevThemeProvider } from "@/contexts/DevThemeContext";
import { AlertaSistema } from "@/components/AlertaSistema";
import { LembreteAgenda } from "@/components/LembreteAgenda";
import { DEV_FONT_VARIABLES } from "@/lib/devThemeFonts";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <DevThemeProvider>
        <div className={`flex h-svh overflow-hidden bg-background ${DEV_FONT_VARIABLES}`}>
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Topbar />
            <main className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin overscroll-contain">
              {children}
            </main>
          </div>
        </div>
        <AlertaSistema />
        <LembreteAgenda />
      </DevThemeProvider>
    </SidebarProvider>
  );
}
