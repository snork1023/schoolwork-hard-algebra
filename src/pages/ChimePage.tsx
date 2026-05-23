import Navigation from "@/components/Navigation";
import { ChimeProvider } from "@/components/chime/ChimeProvider";
import { ChimeShell } from "@/components/chime/ChimeShell";

export default function ChimePage() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-16">
        <ChimeProvider>
          <ChimeShell />
        </ChimeProvider>
      </div>
    </div>
  );
}
