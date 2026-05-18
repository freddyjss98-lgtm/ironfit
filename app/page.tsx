import CustomCursor from "./components/CustomCursor";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Marquee from "./components/Marquee";
import Stats from "./components/Stats";
import Servicios from "./components/Servicios";
import Horarios from "./components/Horarios";
import Mvv from "./components/Mvv";
import Galeria from "./components/Galeria";
import Ubicacion from "./components/Ubicacion";
import Contacto from "./components/Contacto";
import Footer from "./components/Footer";

export default function Page() {
  return (
    <>
      <CustomCursor />
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <Stats />
        <Servicios />
        <Horarios />
        <Mvv />
        <Galeria />
        <Ubicacion />
        <Contacto />
      </main>
      <Footer />
    </>
  );
}
