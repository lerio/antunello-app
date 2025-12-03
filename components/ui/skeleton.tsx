import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "text" | "circle" | "rectangular";
  animation?: "pulse" | "wave" | "none";
}

function Skeleton({
  className,
  variant = "default",
  animation = "pulse",
  ...props
}: SkeletonProps) {
  const animationClass = {
    pulse: "animate-pulse",
    wave: "animate-shimmer",
    none: "",
  }[animation];

  const baseStyles = "bg-gray-200 dark:bg-gray-700 rounded";

  return (
    <div
      className={cn(
        baseStyles,
        animationClass,
        variant === "circle" && "rounded-full",
        variant === "text" && "h-4",
        className
      )}
      role="status"
      aria-label="Loading..."
      {...props}
    />
  );
}

export { Skeleton };
