import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-primary/10", className)}
      {...props}
    />
  )
}

/** Single text line placeholder */
export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={cn('animate-pulse bg-gray-800 rounded h-4', className)} />;
}

/** Block / card placeholder */
export function SkeletonBox({ className = '' }: { className?: string }) {
  return <div className={cn('animate-pulse bg-gray-800 rounded', className)} />;
}

/** Pool / vault table row (matches 6-column table layout) */
export function SkeletonTableRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-4 border-b border-gray-800">
      <SkeletonBox className="w-9 h-9 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonLine className="w-32" />
        <SkeletonLine className="w-20 h-3" />
      </div>
      <SkeletonLine className="w-20" />
      <SkeletonLine className="w-16" />
      <SkeletonLine className="w-16" />
      <SkeletonBox className="w-20 h-8 rounded-lg" />
    </div>
  );
}

/** Stat card (TVL / APY / Volume blocks) */
export function SkeletonStat() {
  return (
    <div className="space-y-2">
      <SkeletonLine className="w-24 h-3" />
      <SkeletonLine className="w-20 h-8" />
      <SkeletonLine className="w-16 h-3" />
    </div>
  );
}

/** LP / vault position card */
export function SkeletonPositionCard() {
  return (
    <div className="p-4 border border-gray-800 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SkeletonBox className="w-8 h-8 rounded-full" />
          <SkeletonLine className="w-24" />
        </div>
        <SkeletonLine className="w-16" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <SkeletonLine className="h-10 rounded-lg" />
        <SkeletonLine className="h-10 rounded-lg" />
        <SkeletonLine className="h-10 rounded-lg" />
      </div>
    </div>
  );
}

export { Skeleton }
