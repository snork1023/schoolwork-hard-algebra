import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImagePreviewDialogProps {
  imageUrl: string | null;
  imageName?: string;
  onClose: () => void;
}

export const ImagePreviewDialog = ({ imageUrl, imageName, onClose }: ImagePreviewDialogProps) => {
  if (!imageUrl) return null;

  return (
    <Dialog open={!!imageUrl} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-background/95 backdrop-blur-sm border-border">
        <div className="relative w-full h-full flex items-center justify-center p-4">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full bg-background/80 hover:bg-background"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
          <img
            src={imageUrl}
            alt={imageName || "Preview"}
            className="max-w-full max-h-[80vh] object-contain rounded-lg"
          />
        </div>
        {imageName && (
          <p className="text-center text-sm text-muted-foreground pb-4">{imageName}</p>
        )}
      </DialogContent>
    </Dialog>
  );
};
