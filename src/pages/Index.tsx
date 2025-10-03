import Navigation from "@/components/Navigation";
import ProxyInput from "@/components/ProxyInput";
import { Shield, Lock, Zap } from "lucide-react";

const Index = () => {
  const features = [
    {
      icon: Shield,
      title: "URL Masking",
      description: "Browse with complete privacy - URLs are masked as about:blank",
    },
    {
      icon: Lock,
      title: "Secure Browsing",
      description: "Your browsing activity stays private and protected",
    },
    {
      icon: Zap,
      title: "Fast & Simple",
      description: "Instant access to any website with just one click",
    },
  ];

  return (
    <div className="min-h-screen">
      <Navigation />
      
      <main className="container mx-auto px-4 pt-32 pb-12">
        <div className="text-center mb-16 animate-fade-in">
          <h1 className="text-6xl font-bold mb-4 glow-text">
            ProxyGate
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Browse the web privately with advanced URL masking technology
          </p>
        </div>

        <div className="mb-20 animate-fade-in">
          <ProxyInput />
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto animate-fade-in">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="bg-card border border-border rounded-lg p-6 text-center hover-glow transition-all hover:scale-105"
              >
                <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default Index;
