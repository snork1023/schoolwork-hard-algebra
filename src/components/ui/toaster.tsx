import { useToast } from "@/hooks/use-toast";
import Toast from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <>
      {toasts.map(({ id, title, description, action, ...props }) => (
        <Toast
          key={id}
          {...props}
          title={title}
          description={description}
          actionLabel={action}
        />
      ))}
    </>
  );
}