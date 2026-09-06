import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, X, Image as ImageIcon, FileText, Video, Mic, BarChart3, Clock, Paperclip, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getUserFriendlyError } from "@/lib/error-utils";
import { compressImageFile } from "@/lib/image-utils";
import { VoiceRecorder } from "./VoiceRecorder";
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
  voiceRecorderOpen: boolean;
  setVoiceRecorderOpen: (open: boolean) => void;
  onCreatePoll: () => void;
}

export const FileUpload = ({ conversationId, onFilesSelected, voiceRecorderOpen, setVoiceRecorderOpen, onCreatePoll }: FileUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Array<{ file: File; preview: string }>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
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
        title: "Some files were not added",
        description: "Use JPG, PNG, GIF, WEBP, PDF, MP4, MOV, or WEBM files under 20MB.",
        variant: "destructive",
      });
    }

    const newFiles = validFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setSelectedFiles([...selectedFiles, ...newFiles]);
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

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error("Not authenticated");

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
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: getUserFriendlyError(error),
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

  const handleVoiceMessage = () => {
    setIsOpen(false);
    setVoiceRecorderOpen(true);
  };

  const handleVoiceRecordingComplete = async (file: { path: string; type: string; name: string; duration?: number }) => {
    // Auto-send voice message immediately
    onFilesSelected([file]);
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
    // Send GIF as a URL-based attachment
    onFilesSelected([{
      url: gifUrl,
      type: "image/gif",
      name: gifName,
    }]);
  };

  const handleScheduleMessage = () => {
    toast({
      title: "Schedule Message",
      description: "Message scheduling coming soon!",
    });
    setIsOpen(false);
  };

  const menuItems = [
    {
      icon: Paperclip,
      label: "Attach Files",
      onClick: () => document.getElementById("file-upload")?.click(),
      color: "text-blue-500",
    },
    {
      icon: Sparkles,
      label: "GIFs",
      onClick: handleGifPicker,
      color: "text-pink-500",
    },
    {
      icon: Mic,
      label: "Voice Message",
      onClick: handleVoiceMessage,
      color: "text-green-500",
    },
    {
      icon: BarChart3,
      label: "Create Poll",
      onClick: handlePollCreation,
      color: "text-purple-500",
    },
    {
      icon: Clock,
      label: "Schedule Message",
      onClick: handleScheduleMessage,
      color: "text-orange-500",
    },
  ];

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 self-center rounded-full flex items-center justify-center"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 rounded-2xl border border-border/60 bg-popover/85 p-2 shadow-2xl backdrop-blur-xl" align="start" side="top" sideOffset={8}>
          <div className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-colors text-left"
              >
                <item.icon className={`h-5 w-5 ${item.color}`} />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            ))}
          </div>

          <input
            id="file-upload"
            type="file"
            multiple
            accept="image/*,video/*,.pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          {selectedFiles.length > 0 && (
            <div className="mt-3 pt-3 border-t space-y-2">
              <p className="text-xs text-muted-foreground px-1">
                {selectedFiles.length} file(s) selected
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {selectedFiles.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-secondary rounded-lg"
                  >
                    {getFileIcon(item.file.type)}
                    <span className="text-xs flex-1 truncate">{item.file.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                className="w-full"
                size="sm"
                onClick={uploadFiles}
                disabled={uploading}
              >
                {uploading ? "Uploading..." : "Upload & Attach"}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <VoiceRecorder
        open={voiceRecorderOpen}
        onOpenChange={setVoiceRecorderOpen}
        conversationId={conversationId}
        onRecordingComplete={handleVoiceRecordingComplete}
      />

      <GifPickerDialog
        open={gifPickerOpen}
        onOpenChange={setGifPickerOpen}
        onGifSelect={handleGifSelect}
      />
    </>
  );
};