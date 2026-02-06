import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, X, Image as ImageIcon, FileText, Video, Mic, BarChart3, Clock, Paperclip, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getUserFriendlyError } from "@/lib/error-utils";
import { VoiceRecorder } from "./VoiceRecorder";
import { GifPickerDialog } from "./GifPickerDialog";
import { ScheduleMessageDialog } from "./ScheduleMessageDialog";

interface FileUploadProps {
  conversationId: string;
  onFilesSelected: (files: Array<{ path?: string; url?: string; type: string; name: string; duration?: number }>) => void;
  voiceRecorderOpen: boolean;
  setVoiceRecorderOpen: (open: boolean) => void;
  onCreatePoll: () => void;
  onScheduleMessage?: (message: string, scheduledAt: Date) => void;
}

export const FileUpload = ({ conversationId, onFilesSelected, voiceRecorderOpen, setVoiceRecorderOpen, onCreatePoll, onScheduleMessage }: FileUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Array<{ file: File; preview: string }>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    const newFiles = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    
    setSelectedFiles([...selectedFiles, ...newFiles]);
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
      for (const { file } of selectedFiles) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${conversationId}/${Date.now()}_${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("chat-attachments")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        uploadedFiles.push({
          path: filePath,
          type: file.type,
          name: file.name,
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
    setIsOpen(false);
    setScheduleDialogOpen(true);
  };

  const handleScheduleSubmit = (message: string, scheduledAt: Date) => {
    if (onScheduleMessage) {
      onScheduleMessage(message, scheduledAt);
    } else {
      toast({
        title: "Message Scheduled",
        description: `Your message will be sent on ${scheduledAt.toLocaleString()}`,
      });
    }
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
        <PopoverContent className="w-64 p-2" align="start" side="top">
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

      <ScheduleMessageDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        onSchedule={handleScheduleSubmit}
      />
    </>
  );
};