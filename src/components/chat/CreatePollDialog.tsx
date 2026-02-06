import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, X, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreatePollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  userId: string;
}

export const CreatePollDialog = ({
  open,
  onOpenChange,
  conversationId,
  userId,
}: CreatePollDialogProps) => {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, ""]);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const resetForm = () => {
    setQuestion("");
    setOptions(["", ""]);
    setMultipleChoice(false);
    setAnonymous(false);
  };

  const handleCreate = async () => {
    const validOptions = options.filter(o => o.trim());
    
    if (!question.trim()) {
      toast({ title: "Please enter a question", variant: "destructive" });
      return;
    }
    
    if (validOptions.length < 2) {
      toast({ title: "At least 2 options required", variant: "destructive" });
      return;
    }

    if (!conversationId || !userId) {
      toast({ title: "Please select a conversation first", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("polls").insert({
        conversation_id: conversationId,
        created_by: userId,
        question: question.trim(),
        options: validOptions,
        multiple_choice: multipleChoice,
        anonymous: anonymous,
      });

      if (error) throw error;

      toast({ title: "Poll created!" });
      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Poll creation error:", error);
      toast({ 
        title: "Failed to create poll", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-500" />
            Create Poll
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="question">Question</Label>
            <Input
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question..."
              maxLength={300}
            />
          </div>

          <div className="space-y-2">
            <Label>Options</Label>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    maxLength={100}
                  />
                  {options.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(index)}
                      className="shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 10 && (
              <Button
                variant="outline"
                size="sm"
                onClick={addOption}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Option
              </Button>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="multiple" className="cursor-pointer">
                Allow multiple votes
              </Label>
              <Switch
                id="multiple"
                checked={multipleChoice}
                onCheckedChange={setMultipleChoice}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="anonymous" className="cursor-pointer">
                Anonymous voting
              </Label>
              <Switch
                id="anonymous"
                checked={anonymous}
                onCheckedChange={setAnonymous}
              />
            </div>
          </div>

          <Button 
            onClick={handleCreate} 
            disabled={loading}
            className="w-full"
          >
            {loading ? "Creating..." : "Create Poll"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
