import Navigation from "@/components/Navigation";

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <article className="max-w-2xl mx-auto space-y-6">
          <header>
            <h1 className="text-4xl font-bold glow-text">About</h1>
            <p className="text-muted-foreground">Project information and credits</p>
          </header>

          <section className="bg-card border border-border rounded-lg p-6 shadow-lg">
            <h2 className="text-xl font-semibold mb-2">Creator</h2>
            <p className="text-muted-foreground">This website was created by <span className="font-medium text-foreground">snorkthedork</span>.</p>
          </section>

          <section className="bg-card border border-border rounded-lg p-6 shadow-lg">
            <h2 className="text-xl font-semibold mb-2">Purpose</h2>
            <p className="text-muted-foreground">A minimal educational gateway with a browser-in-browser experience and privacy-friendly design.</p>
          </section>
        </article>
      </main>
    </div>
  );
};

export default About;
