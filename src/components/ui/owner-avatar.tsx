import { cn } from '@/lib/utils';
import { getAvatarColor } from '@/lib/avatar-colors';

interface OwnerAvatarProps {
  participantId: string;
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

export function OwnerAvatar({ participantId, displayName, initials, avatarUrl, size = 'md', className }: OwnerAvatarProps) {
  const avatarColor = getAvatarColor(participantId);
  
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold flex-shrink-0 ring-2 ring-white',
        sizeClasses[size],
        className
      )}
      style={!avatarUrl ? { backgroundColor: avatarColor.bg, color: avatarColor.text } : undefined}
      title={displayName}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          className="w-full h-full rounded-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const parent = e.currentTarget.parentElement!;
            parent.style.backgroundColor = avatarColor.bg;
            parent.style.color = avatarColor.text;
            parent.textContent = initials;
          }}
        />
      ) : (
        <span className="font-semibold">{initials}</span>
      )}
    </div>
  );
}
