import { Check, CheckCheck } from "lucide-react";

type ReadReceiptsProps = {
  messageId: string;
  readBy: Array<{ user_id: string; username: string; read_at: string }>;
  totalParticipants: number;
  isSender: boolean;
};

const ReadReceipts = ({ readBy, totalParticipants, isSender }: ReadReceiptsProps) => {
  if (!isSender) return null;

  const readCount = readBy.length;
  const isReadByAll = readCount === totalParticipants - 1; // -1 for sender

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
      {isReadByAll ? (
        <CheckCheck className="h-3 w-3 text-primary" />
      ) : readCount > 0 ? (
        <CheckCheck className="h-3 w-3" />
      ) : (
        <Check className="h-3 w-3" />
      )}
    </div>
  );
};

export default ReadReceipts;
