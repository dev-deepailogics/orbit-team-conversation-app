import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { Platform, Pressable } from 'react-native';

// Slack buttons: 8px radius, bold label, green primary, hairline outline.
const buttonVariants = cva(
  cn(
    'group shrink-0 flex-row items-center justify-center gap-2 rounded-lg',
    Platform.select({
      web: "focus-visible:border-ring focus-visible:ring-ring/50 whitespace-nowrap outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
    })
  ),
  {
    variants: {
      variant: {
        default: cn('bg-primary active:bg-primary/90', Platform.select({ web: 'hover:bg-primary/90' })),
        destructive: cn('bg-destructive active:bg-destructive/90', Platform.select({ web: 'hover:bg-destructive/90' })),
        outline: cn('border-input bg-background active:bg-muted border', Platform.select({ web: 'hover:bg-muted' })),
        secondary: cn('bg-muted active:bg-border', Platform.select({ web: 'hover:bg-border' })),
        ghost: cn('active:bg-muted', Platform.select({ web: 'hover:bg-muted' })),
        link: '',
      },
      size: {
        default: 'h-11 px-4',
        sm: 'h-8 gap-1.5 rounded-md px-3',
        lg: 'h-12 px-6',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const buttonTextVariants = cva(
  cn('text-foreground text-base font-bold', Platform.select({ web: 'pointer-events-none transition-colors' })),
  {
    variants: {
      variant: {
        default: 'text-primary-foreground',
        destructive: 'text-destructive-foreground',
        outline: '',
        secondary: '',
        ghost: '',
        link: cn('text-link group-active:underline', Platform.select({ web: 'underline-offset-4 hover:underline group-hover:underline' })),
      },
      size: {
        default: '',
        sm: 'text-sm',
        lg: '',
        icon: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

type ButtonProps = React.ComponentProps<typeof Pressable> & React.RefAttributes<typeof Pressable> & VariantProps<typeof buttonVariants>;

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
      <Pressable
        className={cn(props.disabled && 'opacity-50', buttonVariants({ variant, size }), className)}
        role="button"
        {...props}
      />
    </TextClassContext.Provider>
  );
}

export { Button, buttonTextVariants, buttonVariants };
export type { ButtonProps };
