import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/** 画面中央のフルスクリーンローディング表示。 */
export function FullPageLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  );
}

/** インラインのスピナー。 */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} />;
}
