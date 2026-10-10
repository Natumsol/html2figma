import { useEffect, useState } from "react";
import { labels, link, t, type Language } from "@/lib/i18n";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "../ui/navigation-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { Button } from "../ui/button";
import { X } from "lucide-react";

export function SiteHeader({
  language,
  route,
  version,
}: {
  language: Language;
  route: string;
  version: string;
}) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const l = labels(language);
  const other = language === "en" ? "zh-cn" : "en";
  const links = [
    {
      href: link(language, "docs/getting-started"),
      label: l.docs,
      active: route.startsWith("docs/"),
    },
    {
      href: link(language, "gallery"),
      label: l.gallery,
      active: route === "gallery",
    },
    {
      href: link(language, "playground"),
      label: l.playground,
      active: route === "playground",
    },
    {
      href: link(other, route),
      label: language === "en" ? "中文" : "EN",
      className: "language-link",
    },
    {
      href: "https://github.com/Natumsol/html2figma",
      label: "GitHub ↗",
      aria: "GitHub",
      className: "nav-github",
    },
  ];
  useEffect(() => {
    const background = [
      ...document.querySelectorAll<HTMLElement>(
        "main, footer, .skip-link, .nav-island > .wordmark",
      ),
    ];
    background.forEach((element) => {
      element.inert = open;
    });
    return () =>
      background.forEach((element) => {
        element.inert = false;
      });
  }, [open]);
  useEffect(() => {
    const mobile = matchMedia("(max-width: 767px)");
    const closeDesktop = () => {
      if (!mobile.matches) setOpen(false);
    };
    mobile.addEventListener("change", closeDesktop);
    return () => mobile.removeEventListener("change", closeDesktop);
  }, []);
  return (
    <header className="nav-island">
      <a
        className="wordmark"
        href={link(language)}
        aria-label="html2figma home"
      >
        <img src="/brand/logo.svg" alt="" width="32" height="32" />
        html2figma<span className="release-tag">v{version}</span>
      </a>
      <NavigationMenu
        id="navigation"
        className="desktop-navigation hidden md:flex"
        viewport={false}
        aria-label={t(language, "Main navigation", "主导航")}
      >
        <NavigationMenuList className="gap-5">
          {links.map((item) => (
            <NavigationMenuItem key={item.href}>
              <NavigationMenuLink
                href={item.href}
                active={item.active}
                aria-current={item.active ? "page" : undefined}
                aria-label={item.aria}
                className={`rounded-full px-2 py-1.5 text-sm font-medium ${item.className || ""}`}
              >
                {item.label}
              </NavigationMenuLink>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="menu-toggle hidden max-md:inline-flex"
            disabled={!ready}
            aria-label={t(language, "Toggle navigation", "切换导航")}
          >
            <span />
            <span />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="top"
          showCloseButton={false}
          className="mobile-menu inset-0 h-dvh w-full justify-center border-0 bg-background/90 p-8 backdrop-blur-2xl duration-500 ease-[cubic-bezier(.32,.72,0,1)]"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            document
              .querySelector<HTMLAnchorElement>(".mobile-navigation a")
              ?.focus();
          }}
        >
          <SheetTitle className="sr-only">
            {t(language, "Main navigation", "主导航")}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t(
              language,
              "Choose a page or press Escape to close.",
              "选择页面，或按 Escape 关闭。",
            )}
          </SheetDescription>
          <SheetClose asChild>
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-8 top-8 size-10 rounded-full"
              aria-label={t(language, "Close navigation", "关闭导航")}
            >
              <X strokeWidth={1.2} />
            </Button>
          </SheetClose>
          <nav
            className="mobile-navigation"
            aria-label={t(language, "Mobile navigation", "手机导航")}
          >
            {links.map((item, index) => (
              <a
                key={item.href}
                href={item.href}
                aria-label={item.aria}
                aria-current={item.active ? "page" : undefined}
                onClick={() => setOpen(false)}
                style={{ animationDelay: `${index * 60}ms` }}
                className="animate-in fade-in-0 slide-in-from-bottom-4 duration-700 ease-[cubic-bezier(.32,.72,0,1)]"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
