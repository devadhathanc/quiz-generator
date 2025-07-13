import { cn } from "@/lib/utils";

interface LoadingOverlayProps {
  isVisible: boolean;
  title?: string;
  message?: string;
  className?: string;
}

export function LoadingOverlay({ 
  isVisible, 
  title = "Loading...", 
  message = "Please wait while we process your request.",
  className 
}: LoadingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className={cn(
      "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50",
      className
    )}>
      <div className="bg-white rounded-3xl p-8 max-w-md w-full mx-4 text-center">
        <div className="animate-spin w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}
