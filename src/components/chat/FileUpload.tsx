import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, X, Image as ImageIcon, FileText, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface FileUploadProps {
  onFilesSelected: (files: Array<{ url: string; type: string; name: string }>) => void;
}

export const FileUpload = ({ onFilesSelected }: FileUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Array<{ file: File; preview: string }>>([]);
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
    if (selectedFiles.length === 0) return;

    setUploading(true);
    const uploadedFiles: Array<{ url: string; type: string; name: string }> = [];

    try {
      for (const { file } of selectedFiles) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${Date.now()}_${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("chat-attachments")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("chat-attachments")
          .getPublicUrl(filePath);

        uploadedFiles.push({
          url: data.publicUrl,
          type: file.type,
          name: file.name,
        });
      }

      onFilesSelected(uploadedFiles);
      setSelectedFiles([]);
      selectedFiles.forEach(({ preview }) => URL.revokeObjectURL(preview));
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Plus className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="file-upload" className="text-sm font-medium">
              Attach Files
            </label>
            <input
              id="file-upload"
              type="file"
              multiple
              accept="image/*,video/*,.pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              Choose Files
            </Button>
          </div>

          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {selectedFiles.length} file(s) selected
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedFiles.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-secondary rounded-lg"
                  >
                    {getFileIcon(item.file.type)}
                    <span className="text-sm flex-1 truncate">{item.file.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                className="w-full"
                onClick={uploadFiles}
                disabled={uploading}
              >
                {uploading ? "Uploading..." : "Upload & Send"}
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
