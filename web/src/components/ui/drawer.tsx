import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}

export function Drawer({ open, onOpenChange, title, description, children }: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-line bg-surface shadow-2xl focus:outline-none">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-sm font-semibold text-text">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 truncate text-xs text-muted">{description}</Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close className="rounded-md p-1 text-muted transition-colors hover:bg-surface-raised hover:text-text">
              <X size={16} />
            </Dialog.Close>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
