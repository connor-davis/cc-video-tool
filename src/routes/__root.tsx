import {
  Link,
  Outlet,
  createRootRouteWithContext,
} from "@tanstack/react-router"
import {
  DesktopIcon,
  MoonIcon,
  SparkleIcon,
  SunIcon,
  VideoCameraIcon,
} from "@phosphor-icons/react"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

export const Route = createRootRouteWithContext<Record<string, never>>()({
  component: RootLayout,
  notFoundComponent: RootNotFound,
})

function RootLayout() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-3xl border bg-card/80 p-4 text-card-foreground shadow-xs backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <VideoCameraIcon weight="fill" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold">CC Video Tool</h1>
                    <Badge variant="secondary">TanStack Router</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    File-based routes, inline route components, and a fully
                    installed shadcn UI layer.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <nav className="flex flex-wrap gap-2">
                <Link
                  to="/"
                  activeOptions={{ exact: true }}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "rounded-full"
                  )}
                  activeProps={{
                    className: cn(
                      buttonVariants({ variant: "secondary", size: "sm" }),
                      "rounded-full"
                    ),
                  }}
                >
                  Home
                </Link>
                <Link
                  to="/about"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "rounded-full"
                  )}
                  activeProps={{
                    className: cn(
                      buttonVariants({ variant: "secondary", size: "sm" }),
                      "rounded-full"
                    ),
                  }}
                >
                  About
                </Link>
              </nav>

              <ThemeToggle />
            </div>
          </div>
        </header>

        <Separator className="my-6" />

        <main className="flex-1">
          <Outlet />
        </main>

        <footer className="mt-6 flex flex-col gap-2 rounded-3xl border bg-card p-4 text-sm text-muted-foreground shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <span>Built with React 19, Vite, TanStack Router, and shadcn/ui.</span>
          <span>Theme shortcut: press `d` to toggle dark mode.</span>
        </footer>
      </div>
    </div>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={theme === "light" ? "secondary" : "outline"}
        size="sm"
        onClick={() => setTheme("light")}
      >
        <SunIcon data-icon="inline-start" />
        Light
      </Button>
      <Button
        variant={theme === "dark" ? "secondary" : "outline"}
        size="sm"
        onClick={() => setTheme("dark")}
      >
        <MoonIcon data-icon="inline-start" />
        Dark
      </Button>
      <Button
        variant={theme === "system" ? "secondary" : "outline"}
        size="sm"
        onClick={() => setTheme("system")}
      >
        <DesktopIcon data-icon="inline-start" />
        System
      </Button>
    </div>
  )
}

function RootNotFound() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex max-w-lg flex-col items-center gap-4 rounded-3xl border bg-card p-8 text-center shadow-xs">
        <Badge variant="outline">404</Badge>
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            Route not found
          </h2>
          <p className="text-sm text-muted-foreground">
            This page is outside the current route tree. Head back to the home
            screen and keep exploring.
          </p>
        </div>
        <Link to="/" className={buttonVariants({ variant: "default" })}>
          <SparkleIcon data-icon="inline-start" />
          Return home
        </Link>
      </div>
    </div>
  )
}
