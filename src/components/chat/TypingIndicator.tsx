type TypingIndicatorProps = {
  typingUsers: string[];
};

const TypingIndicator = ({ typingUsers }: TypingIndicatorProps) => {
  if (typingUsers.length === 0) return null;

  const displayText = typingUsers.length === 1
    ? `${typingUsers[0]} is typing...`
    : typingUsers.length === 2
    ? `${typingUsers[0]} and ${typingUsers[1]} are typing...`
    : `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`;

  return (
    <div className="px-4 py-2 text-sm text-muted-foreground italic">
      {displayText}
      <span className="inline-flex ml-1 space-x-1">
        <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
        <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
        <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
      </span>
    </div>
  );
};

export default TypingIndicator;
