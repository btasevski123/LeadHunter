import { toast } from 'sonner';

export const notify = {
  success: (message: string, description?: string) =>
    toast.success(message, description ? { description } : undefined),
  error: (error: unknown, fallback = 'Something went wrong') => {
    if (typeof error === 'string' && error.trim()) {
      toast.error(error);
      return;
    }
    const message =
      error instanceof Error && error.message.trim() ? error.message : fallback;
    toast.error(message);
  },
  info: (message: string, description?: string) =>
    toast.message(message, description ? { description } : undefined),
};
