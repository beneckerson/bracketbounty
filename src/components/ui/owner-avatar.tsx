import { cn } from '@/lib/utils';

interface OwnerAvatarProps {
  displayName: string;
  initials: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
};

export function OwnerAvatar({ displayName, initials, avatarUrl, size = 'md', className }: OwnerAvatarProps) {
  return (
    <div
      className={cn(
        'owner-avatar flex-shrink-0 ring-2 ring-white',
        sizeClasses[size],
        className
      )}
      title={displayName}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          className="w-full h-full rounded-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentElement!.textContent = initials;
          }}
        />
      ) : (
        <span className="font-semibold">{initials}</span>
      )}
    </div>
  );
}
