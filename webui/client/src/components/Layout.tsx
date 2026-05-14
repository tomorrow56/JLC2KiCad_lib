import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { Cpu, History, LogOut, LogIn, Zap } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import type { Language } from "@/contexts/I18nContext";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { lang, setLang, t } = useI18n();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => logout(),
  });

  const navLinks = [
    { href: "/", label: t("nav_convert"), icon: Zap },
    { href: "/history", label: t("nav_history"), icon: History },
  ];

  const languages: { code: Language; label: string }[] = [
    { code: "en", label: "EN" },
    { code: "ja", label: "JA" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top navigation */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Cpu className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-sm tracking-wide">
              <span className="text-gold-gradient">JLC</span>
              <span className="text-foreground/80">2KiCad</span>
            </span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const active = location === href;
              return (
                <Link key={href} href={href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`gap-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* Right side: language toggle + auth */}
          <div className="flex items-center gap-2">
            {/* Language toggle */}
            <div className="flex items-center rounded-md border border-border/60 overflow-hidden">
              {languages.map(({ code, label }) => (
                <button
                  key={code}
                  onClick={() => setLang(code)}
                  className={`px-2 py-1 text-[10px] font-semibold tracking-wider transition-colors ${
                    lang === code
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 h-8 px-2">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                        {user.name?.charAt(0).toUpperCase() ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground hidden sm:block max-w-24 truncate">
                      {user.name}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    onClick={() => logoutMutation.mutate()}
                    className="text-xs gap-2 text-muted-foreground"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    {t("nav_signout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => (window.location.href = getLoginUrl())}
              >
                <LogIn className="w-3.5 h-3.5" />
                {t("nav_signin")}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-4">
        <div className="container flex items-center justify-between text-xs text-muted-foreground">
          <span>JLC2KiCad Web UI</span>
          <a
            href="https://github.com/TousstNicolas/JLC2KiCad_lib"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            {t("footer_powered")}
          </a>
        </div>
      </footer>
    </div>
  );
}
