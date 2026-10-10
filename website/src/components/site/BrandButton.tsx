import type { ComponentProps } from "react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import { ArrowUpRight, Download } from "lucide-react";
type Props = ComponentProps<typeof Button> & {
  href?: string;
  download?: boolean | string;
  label?: string;
  arrow?: boolean;
  tone?: "primary" | "dark" | "secondary";
};
export function BrandButton({
  href,
  download,
  label,
  children,
  arrow,
  tone = "primary",
  className,
  ...props
}: Props) {
  const styles = cn(
    "button h-auto min-h-12 shrink gap-5 rounded-full border-0 px-6 py-3 text-sm font-medium shadow-none max-md:gap-4 max-md:px-5 max-md:text-[13px] active:scale-[.98]",
    tone === "dark"
      ? "dark bg-foreground text-white hover:bg-foreground"
      : tone === "secondary"
        ? "secondary bg-secondary text-foreground hover:bg-secondary"
        : "primary bg-primary text-white hover:bg-primary",
    className,
  );
  const content = (
    <>
      {label || children}
      {arrow && (
        <span className="button-icon" aria-hidden="true">
          {download ? (
            <Download strokeWidth={1.2} />
          ) : (
            <ArrowUpRight strokeWidth={1.2} />
          )}
        </span>
      )}
    </>
  );
  if (href)
    return (
      <Button asChild className={styles}>
        <a
          href={href}
          download={download}
          data-action={download ? "download" : "navigate"}
        >
          {content}
        </a>
      </Button>
    );
  return (
    <Button className={styles} {...props}>
      {content}
    </Button>
  );
}
