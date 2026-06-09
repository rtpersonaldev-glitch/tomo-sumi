import { Outlet } from "react-router-dom";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";

export function AppLayout() {
  return (
    <div className="flex h-dvh flex-col">
      <AppHeader />
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
