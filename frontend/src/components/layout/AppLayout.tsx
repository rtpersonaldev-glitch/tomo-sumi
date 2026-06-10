import { Outlet } from "react-router-dom";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <Sidebar />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="md:hidden">
          <AppHeader />
        </div>
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
