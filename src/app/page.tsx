import Nav from "@/components/sites/newmixcoffee-com-8d5a8741/en-7a4ba3ba/Nav";
import ScrollShell from "@/components/sites/newmixcoffee-com-8d5a8741/en-7a4ba3ba/ScrollShell";
import StatementSection from "@/components/sites/newmixcoffee-com-8d5a8741/en-7a4ba3ba/StatementSection";
import FeaturesHeroSection from "@/components/sites/newmixcoffee-com-8d5a8741/en-7a4ba3ba/FeaturesHeroSection";
import ContactSection from "@/components/sites/newmixcoffee-com-8d5a8741/en-7a4ba3ba/ContactSection";
import Footer from "@/components/sites/newmixcoffee-com-8d5a8741/en-7a4ba3ba/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <ScrollShell>
        <div className="white-bg-content">
          <StatementSection />
          <FeaturesHeroSection />
          <ContactSection />
          <Footer />
        </div>
      </ScrollShell>
    </>
  );
}
