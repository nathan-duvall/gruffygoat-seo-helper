import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Globe, LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

function SidebarLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Fixed left sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r bg-card">
        <div className="flex h-14 items-center px-4 border-b">
          <h1 className="text-base font-semibold tracking-tight text-foreground">GruffyGoat SEO</h1>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          <SidebarLink to="/"><Globe className="h-4 w-4" /> Sites</SidebarLink>
        </nav>
        <div className="border-t p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">{user?.email}</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme} title="Toggle theme">
                {theme === "light" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSignOut} title="Sign out">
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </aside>
      {/* Main content offset by sidebar width */}
      <main className="ml-56 flex-1 min-h-screen">
        <div className="mx-auto max-w-6xl px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
