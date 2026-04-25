import Navigation from "@/components/Navigation";
import ProxyInput from "@/components/ProxyInput";
import { Shield, Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

const Index = () => {
  const navigate = useNavigate();
  const features = [];

  const [messageIndex, setMessageIndex] = useState(Math.floor(Math.random() * messages.length));

  const messages = [
    "dont click me",
    "click me (｡˃ ᵕ ˂ )",
    "this message is super rare",
    "if it doesn't work ur not worthy",
    "do it again",
    "snorkthedork was never real",
    "how bored must you be",
    "click me for a secret coin!",
    "good luck finding that coin",
    "ok thats enough",
    ":>",
    "ctrl + shift + qq",
    "UwU",
    "v1 was trash",
    "+1 cookie",
    "bet on red",
    "#Japan is turning footsteps into electricity! Using piezoelectric tiles, every step you take generates a small amount of energy.",
    "who reads these anyway"
  ];

  return <div className="min-h-screen">
      <Navigation />
      
      <main className="container mx-auto px-4 pt-32 pb-12">
        <div className="text-center mb-16 animate-fade-in">
          <h1 className="text-5xl font-bold mb-4 glow-text">
            Kepler
          </h1>
          <p
            onClick={() => setMessageIndex(Math.floor(Math.random() * messages.length))}
            className="text-xl text-muted-foreground max-w-2xl mx-auto mb-6 cursor-pointer select-none"
          >
            {messages[messageIndex]}
          </p>
          
        </div>

        <div className="mb-20 animate-fade-in">
          <ProxyInput />
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto animate-fade-in">
          {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <div key={index} className="p-6 rounded-xl border border-border bg-card text-card-foreground">
              <Icon className="w-8 h-8 text-primary mb-3" />
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          );
        })}
        </div>
      </main>
    </div>;
};
export default Index;
