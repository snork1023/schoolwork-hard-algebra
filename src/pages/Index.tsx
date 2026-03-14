import Navigation from "@/components/Navigation";
import ProxyInput from "@/components/ProxyInput";
import { Shield, Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
const Index = () => {
  const navigate = useNavigate();
  const features = [{
    icon: Shield,
    title: "Browser Privacy",
    description: "Access educational content with customizable browser interfaces"
  }, {
    icon: Lock,
    title: "Secure Access",
    description: "Your browsing activity stays private and protected"
  }, {
    icon: Zap,
    title: "Fast & Simple",
    description: "Instant access to educational resources with just one click"
  }];
  return <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 pt-32 pb-12">
        <div className="text-center mb-16 animate-fade-in">
          <h1 className="text-5xl font-bold mb-4 glow-text">
            Totally Schoolwork and Not Games
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-6">made by snorkthedork</p>
          
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