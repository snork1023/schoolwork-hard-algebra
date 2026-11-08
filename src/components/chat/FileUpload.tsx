import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/buttons/button";
import { Plus, X, Image as ImageIcon, FileText, Video, BarChart3, Paperclip, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays/popover";
import { getUserFriendlyError } from "@/lib/error-utils";
import { compressImageFile } from "@/lib/image-utils";
import { removeChatAttachmentObjects } from "@/lib/chat-attachments";
import { GifPickerDialog } from "./GifPickerDialog";

const MAX_CHAT_ATTACHMENT_SIZE = 20 * 1024 * 1024;
const ALLOWED_CHAT_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);
const ALLOWED_CHAT_ATTACHMENT_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "pdf",
  "mp4",
  "mov",
  "webm",
]);

interface FileUploadProps {
  conversationId: string;
  onFilesSelected: (files: Array<{ path?: string; url?: string; type: string; name: string; duration?: number }>) => void;
  onCreatePoll: () => void;
  disabled?: boolean;
}

export const FileUpload = ({ conversationId, onFilesSelected, onCreatePoll, disabled = false }: FileUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Array<{ file: File; preview: string }>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const files = Array.from(event.target.files || []);

    const validFiles = files.filter((file) => {
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      return (
        file.size <= MAX_CHAT_ATTACHMENT_SIZE &&
        ALLOWED_CHAT_ATTACHMENT_TYPES.has(file.type) &&
        ALLOWED_CHAT_ATTACHMENT_EXTENSIONS.has(extension)
      );
    });

    if (validFiles.length !== files.length) {
      toast({
        title: "Unsupported file format",
        description: "Some files could not be uploaded due to an unsupported format or file size limit.",
        variant: "destructive",
      });
    }

    const newFiles = validFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setSelectedFiles(current => [...current, ...newFiles]);
    if (validFiles.length > 0) setIsOpen(true);
    event.target.value = "";
  };

  const removeFile = (index: number) => {
    const newFiles = [...selectedFiles];
    URL.revokeObjectURL(newFiles[index].preview);
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0 || !conversationId) return;

    setUploading(true);
    const uploadedFiles: Array<{ path: string; type: string; name: string }> = [];
    let uploadUserId: string | null = null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error("Not authenticated");
      uploadUserId = userId;

      for (const { file } of selectedFiles) {
        if (
          file.size > MAX_CHAT_ATTACHMENT_SIZE ||
          !ALLOWED_CHAT_ATTACHMENT_TYPES.has(file.type) ||
          !ALLOWED_CHAT_ATTACHMENT_EXTENSIONS.has(file.name.split(".").pop()?.toLowerCase() || "")
        ) {
          throw new Error("This file type is not allowed or the file is larger than 20MB.");
        }

        const uploadFile = file.type.startsWith("image/")
          ? await compressImageFile(file, {
              maxWidth: 1920,
              quality: 0.8,
              maxSizeMB: 2,
            })
          : file;
        const fileExt = uploadFile.name.split(".").pop() || "bin";
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${conversationId}/${userId}/${Date.now()}_${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("chat-attachments")
          .upload(filePath, uploadFile);

        if (uploadError) throw uploadError;

        uploadedFiles.push({
          path: filePath,
          type: uploadFile.type,
          name: uploadFile.name,
        });
      }

      onFilesSelected(uploadedFiles);
      setSelectedFiles([]);
      selectedFiles.forEach(({ preview }) => URL.revokeObjectURL(preview));
      setIsOpen(false);
    } catch (error: unknown) {
      let cleanupError: unknown;
      if (uploadedFiles.length > 0 && uploadUserId) {
        try {
          await removeChatAttachmentObjects(
            uploadedFiles.map(file => file.path),
            uploadUserId,
          );
        } catch (removeError: unknown) {
          cleanupError = removeError;
        }
      }
      toast({
        title: "Upload failed",
        description: cleanupError
          ? `${getUserFriendlyError(error)} Some uploaded files could not be removed: ${getUserFriendlyError(cleanupError)}`
          : getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
    if (type.startsWith("video/")) return <Video className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const handlePollCreation = () => {
    setIsOpen(false);
    onCreatePoll();
  };

  const handleGifPicker = () => {
    setIsOpen(false);
    setGifPickerOpen(true);
  };

  const handleGifSelect = (gifUrl: string, gifName: string) => {
    if (disabled) return;
    // Send GIF as a URL-based attachment
    setGifPickerOpen(false);
    onFilesSelected([{
      url: gifUrl,
      type: "image/gif",
      name: gifName,
    }]);
  };

  const handleActionSelect = (value: string) => {
    if (disabled) return;
    switch (value) {
      case "photos":
        document.getElementById("file-upload")?.click();
        break;
      case "gifs":
        handleGifPicker();
        break;
      case "polls":
        handlePollCreation();
        break;
    }
  };

  return (
    <>
      <Popover
        open={isOpen && !disabled}
        onOpenChange={open => {
          if (!disabled) setIsOpen(open);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            disabled={disabled}
            variant="ghost"
            size="icon"
            aria-label="Open attachment menu"
            className="order-2 h-9 w-9 shrink-0 self-center rounded-full bg-transparent text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="top"
          sideOffset={12}
          className="w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-[26px] border-border/60 bg-popover/95 p-4 shadow-2xl backdrop-blur-xl data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-3 data-[state=open]:duration-200"
        >
          <div className="mb-3">
            <p className="text-sm font-semibold">Add to message</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Choose what you want to share</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "photos", label: "Photos", Icon: ImageIcon, color: "text-sky-600 dark:text-sky-400", tint: "bg-sky-500/10" },
              { value: "gifs", label: "GIFs", Icon: Sparkles, color: "text-violet-600 dark:text-violet-400", tint: "bg-violet-500/10" },
              { value: "polls", label: "Poll", Icon: BarChart3, color: "text-emerald-600 dark:text-emerald-400", tint: "bg-emerald-500/10" },
            ].map(({ value, label, Icon, color, tint }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleActionSelect(value)}
                className="group flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-border/50 bg-background/60 p-3 text-sm font-medium transition-all hover:-translate-y-0.5 hover:border-border hover:bg-accent active:translate-y-0"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tint} ${color} transition-transform group-hover:scale-105`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span>{label}</span>
              </button>
            ))}
          </div>

          {selectedFiles.length > 0 && (
            <div className="mt-4 grid max-h-40 grid-cols-4 gap-2 overflow-y-auto border-t border-border/50 pt-4">
              {selectedFiles.map((item, index) => (
                <div key={`${item.file.name}-${index}`} className="group relative aspect-square overflow-hidden rounded-xl bg-secondary">
                  {item.file.type.startsWith("image/") ? (
                    <img src={item.preview} alt={item.file.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1 p-1 text-muted-foreground">
                      {getFileIcon(item.file.type)}
                      <span className="w-full truncate text-center text-[10px]">{item.file.name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${item.file.name}`}
                    onClick={() => removeFile(index)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {selectedFiles.length > 0 && (
            <Button
              type="button"
              className="mt-3 w-full"
              size="sm"
              onClick={uploadFiles}
              disabled={disabled || uploading}
            >
              {uploading ? "Uploading..." : "Upload & Attach"}
            </Button>
          )}
        </PopoverContent>
      </Popover>
      <input
        id="file-upload"
        type="file"
        multiple
        accept="image/*,video/*,.pdf"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        id="camera-capture"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      <GifPickerDialog
        open={gifPickerOpen && !disabled}
        onOpenChange={open => {
          if (!disabled) setGifPickerOpen(open);
        }}
        onGifSelect={handleGifSelect}
      />
    </>
  );
};