import { Lock, Unlock, KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LockIconProps {
  locked: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  animated?: boolean;
}

const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

export function LockIcon({ locked, size = 'md', className, animated = false }: LockIconProps) {
  const Icon = locked ? Lock : Unlock;
  
  return (
    <Icon
      className={cn(
        sizeMap[size],
        locked ? 'text-locked' : 'text-unlocked',
        animated && locked && 'animate-lock-pulse',
        animated && !locked && 'animate-unlock',
        className
      )}
    />
  );
}

interface LockBadgeProps {
  locked: boolean;
  className?: string;
}

export function LockBadge({ locked, className }: LockBadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        locked 
          ? 'bg-locked/10 text-locked border border-locked/20' 
          : 'bg-unlocked/10 text-unlocked border border-unlocked/20',
        className
      )}
    >
      <LockIcon locked={locked} size="sm" />
      <span>{locked ? 'Locked' : 'Unlocked'}</span>
    </div>
  );
}

export function KeyIcon({ className }: { className?: string }) {
  return <KeyRound className={cn('text-primary', className)} />;
}
