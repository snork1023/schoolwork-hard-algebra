import { Check, X } from "lucide-react";
import { getPasswordChecks } from "./password-rules";

export default function PasswordGuide({ password }: { password: string }) {
  const checks = getPasswordChecks(password);
  const requirements = [
    { valid: checks.length, text: "At least 8 characters" },
    { valid: checks.uppercase, text: "One uppercase letter" },
    { valid: checks.lowercase, text: "One lowercase letter" },
    { valid: checks.number, text: "One number" },
  ];

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      {requirements.map(({ valid, text }) => (
        <div
          key={text}
          className={`flex items-center gap-2 transition-all duration-300 ${
            valid ? "text-green-500" : "text-muted-foreground"
          }`}
        >
          <div
            className={`transition-all duration-300 ${
              valid ? "rotate-0 scale-100" : "-rotate-90 scale-75"
            }`}
          >
            {valid ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </div>
          <span>{text}</span>
        </div>
      ))}
    </div>
  );
}
