import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn/ui 標準のクラス結合ユーティリティ。 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
