import { ReactNode, useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Globe, Home, LogOut, Moon, Sun, Settings, PanelLeftClose, PanelLeft, X } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const SIDEBAR_KEY = "sidebar-collapsed";

function SidebarLink({
  to,
  children,
  icon,
  label,
  collapsed,
}: {
  to: string;
  children?: ReactNode;
  icon: ReactNode;
  label: string;
  collapsed: boolean;
}) {
  const link = (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center rounded-md text-sm font-medium transition-colors",
          collapsed ? "justify-center h-8 w-8" : "gap-2.5 px-3 py-2",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )
      }
    >
      {icon}
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SIDEBAR_KEY) === "true";
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, String(collapsed));
  }, [collapsed]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const sidebarWidth = collapsed ? "w-16" : "w-56";

  const sidebarContent = (
    <>
      {/* Header */}
      <div className={cn("flex h-14 items-center border-b", collapsed ? "justify-center px-2" : "px-4")}>
        {!collapsed && (
          <h1 className="text-base font-semibold tracking-tight text-foreground truncate">GruffyGoat SEO</h1>
        )}
        {isMobile && (
          <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto" onClick={() => setMobileOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Nav */}
      <nav className={cn("flex-1 py-4", collapsed ? "px-0 flex flex-col items-center space-y-2" : "px-3 space-y-1")}>
        <TooltipProvider delayDuration={0}>
          <SidebarLink to="/" icon={<Home className="h-4 w-4 shrink-0" />} label="Welcome" collapsed={collapsed} />
          <SidebarLink to="/sites" icon={<Globe className="h-4 w-4 shrink-0" />} label="Sites" collapsed={collapsed} />
        </TooltipProvider>
      </nav>

      {/* Settings + Version footer */}
      <div className={cn(collapsed ? "px-0 flex flex-col items-center space-y-2 py-2" : "px-3 space-y-1")}>
        <TooltipProvider delayDuration={0}>
          <SidebarLink to="/settings" icon={<Settings className="h-4 w-4 shrink-0" />} label="Global Settings" collapsed={collapsed} />
        </TooltipProvider>
      </div>
      {!collapsed && (
        <div className="px-4 py-3 border-t border-b">
          <p className="text-[11px] font-medium text-muted-foreground">GruffyGoat SEO</p>
          <p className="text-[10px] text-muted-foreground">Version 0.1 Alpha</p>
          <p className="text-[10px] text-muted-foreground/70">Experimental – Not for production use</p>
        </div>
      )}

      {/* User area */}
      <div className={cn("p-3 space-y-2", collapsed && "flex flex-col items-center")}>
        {collapsed ? (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme}>
                  {theme === "light" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Toggle theme</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSignOut}>
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
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
        )}
      </div>
    </>
  );

  // Mobile: overlay drawer
  if (isMobile) {
    return (
      <div className="flex min-h-screen bg-background">
        {/* Overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-200"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Drawer */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r bg-card transition-transform duration-200 ease-in-out",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {sidebarContent}
        </aside>

        {/* Main */}
        <div className="flex-1 min-h-screen">
          <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background px-4">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileOpen(true)}>
              <PanelLeft className="h-4 w-4" />
            </Button>
            <span className="ml-2 text-base font-semibold tracking-tight text-foreground">GruffyGoat SEO</span>
          </header>
          <div className="mx-auto max-w-6xl px-4 py-6">
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Desktop
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-card transition-all duration-200 ease-in-out",
          sidebarWidth
        )}
      >
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main
        className={cn(
          "flex-1 min-h-screen transition-all duration-200 ease-in-out",
          collapsed ? "ml-16" : "ml-56"
        )}
      >
        <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background px-6">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </header>
        <div className="mx-auto max-w-6xl px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
