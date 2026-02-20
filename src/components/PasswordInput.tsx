import { useState, forwardRef } from 'react';
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  id?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ value, onChange, placeholder = 'Enter password', className, autoFocus, disabled, id }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    
    return (
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
        </div>
        <Input
          ref={ref}
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'pl-10 pr-10 font-mono text-sm',
            'bg-muted/50 border-border/50',
            'focus:border-primary focus:ring-primary/20',
            'placeholder:text-muted-foreground/50',
            className
          )}
          autoFocus={autoFocus}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  const checks = [
    { label: '12+ characters', met: password.length >= 12 },
    { label: 'Uppercase', met: /[A-Z]/.test(password) },
    { label: 'Lowercase', met: /[a-z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
    { label: 'Special char', met: /[^A-Za-z0-9]/.test(password) },
  ];
  
  const metCount = checks.filter(c => c.met).length;
  const strengthPercent = (metCount / checks.length) * 100;
  
  const getStrengthColor = () => {
    if (strengthPercent <= 40) return 'bg-destructive';
    if (strengthPercent <= 60) return 'bg-warning';
    if (strengthPercent <= 80) return 'bg-primary';
    return 'bg-unlocked';
  };
  
  return (
    <div className={cn('space-y-3', className)}>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full transition-all duration-300', getStrengthColor())}
          style={{ width: `${strengthPercent}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {checks.map((check) => (
          <span
            key={check.label}
            className={cn(
              'text-xs px-2 py-1 rounded-md border transition-colors',
              check.met
                ? 'border-unlocked/30 bg-unlocked/10 text-unlocked'
                : 'border-border/50 bg-muted/50 text-muted-foreground'
            )}
          >
            {check.label}
          </span>
        ))}
      </div>
    </div>
  );
}

interface UnlockButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function UnlockButton({ onClick, loading, disabled, children, className }: UnlockButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'w-full gap-2',
        'bg-primary text-primary-foreground',
        'hover:bg-primary/90 hover:shadow-glow',
        'transition-all duration-200',
        className
      )}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Deriving key...
        </>
      ) : (
        children || 'Unlock'
      )}
    </Button>
  );
}
