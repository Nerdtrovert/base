import { cn } from '../lib/utils';

type BrandMarkProps = {
  className?: string;
  alt?: string;
};

export function BrandMark({ className, alt = 'Base logo' }: BrandMarkProps) {
  return (
    <img
      src="/logo-mark.svg"
      alt={alt}
      className={cn('h-10 w-10 object-contain', className)}
    />
  );
}
