import Nav from "@/components/sites/newmixcoffee-com-8d5a8741/en-7a4ba3ba/Nav";
import ServicesSection from "@/components/sites/newmixcoffee-com-8d5a8741/en-7a4ba3ba/ServicesSection";
import ContactInviteSection from "@/components/sites/newmixcoffee-com-8d5a8741/en-7a4ba3ba/ContactInviteSection";
import Footer from "@/components/sites/newmixcoffee-com-8d5a8741/en-7a4ba3ba/Footer";
import ScrollToNextIndicator from "@/components/sites/newmixcoffee-com-8d5a8741/en-7a4ba3ba/ScrollToNextIndicator";

export default function ServiciosPage() {
  return (
    <>
      <Nav />
      <ServicesSection />
      <ContactInviteSection />
      <Footer />
      <ScrollToNextIndicator label="Nosotros" href="/nosotros" />
    </>
  );
}
