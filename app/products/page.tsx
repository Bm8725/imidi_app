import Link from "next/link";

export const metadata = {
  title: "iMIDI Accordion MIDI Kit — Installation Guide",
  description: "Ghid tehnic de instalare și calibrare pentru kitul MIDI digital dedicat acordeoanelor.",
};

export default function AccordionMidiKitInstallation() {
  const kitSteps = [
    {
      step: "01",
      badge: "grille sensor strip",
      title: "Montarea Matricei de Contact (Clape/Butoane)",
      desc: "Fixează banda magnetică sau senzorii optici iMIDI sub masca de clape (sau butoane) a acordeonului. Conectează magistrala flexibilă la placa centrală. Asigură-te că fiecare clapetă atinge axul de contact fără frecare mecanică pentru a păstra dinamica nativă a instrumentului.",
      imgSrc: "/accordion-step1.jpg", 
    },
    {
      step: "02",
      badge: "bellows pressure sensor",
      title: "Senzorul de Presiune (Controlul Burdufului)",
      desc: "Instalează senzorul barometric de înaltă rezoluție în interiorul carcasei, etanșând zona de trecere a aerului. Acest senzor traduce presiunea și depresiunea burdufului (expansiune/compresie) în mesaje MIDI Continuous Controller (CC11 / Expression), oferind expresivitate maximă sintetizatorului.",
      imgSrc: "/accordion-step2.jpg",
    },
    {
      step: "03",
      badge: "bass matrix link",
      title: "Cablarea Mecanismului de Bași & Power",
      desc: "Rutează conexiunea către sistemul de bași și compartimentul de baterii/USB-C plasat discret pe masca din spate. Pornește modulul iMIDI; indicatorul Cyan va pulsa, confirmând că microcontrolerul scanează clapele, bașii și burduful cu o latență de scanare de sub 1ms.",
      imgSrc: "/accordion-step3.jpg",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0D0E12] text-white overflow-x-hidden selection:bg-[#00F2FE]/30 selection:text-[#00F2FE]">
      {/* Lumini ambientale decorative */}
      <div className="absolute top-[-5%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#00F2FE]/5 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#9B51E0]/5 blur-[150px] pointer-events-none" />

      <main className="max-w-5xl mx-auto px-6 pt-28 pb-24 relative z-10">
        
        {/* Header Pagina - Prezentare Kit Acordeon */}
        <div className="flex flex-col items-center text-center mb-20">
          <span className="aw-nav-mono text-[9px] uppercase tracking-[0.3em] text-[#00F2FE] bg-[#00F2FE]/10 px-4 py-1.5 rounded-full border border-[#00F2FE]/20 mb-6 font-bold shadow-[0_0_15px_rgba(0,242,254,0.12)]">
            iMIDI Accordion System Installation
          </span>
          <h1 className="aw-nav-display font-black text-3xl md:text-5xl tracking-tight uppercase max-w-3xl leading-none">
            Kit Digital MIDI <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00F2FE] via-[#4FACFE] to-[#9B51E0]">
              Pentru Acordeon
            </span>
          </h1>
          <p className="aw-nav-mono text-xs text-[#8E9AA8] max-w-xl mt-5 leading-relaxed">
            Transformă-ți acordeonul acustic într-un sintetizator next-gen. Ghidul tehnic pas cu pas pentru montarea senzorilor, calibrarea presiunii aerului și conectarea wireless/USB-C la aplicație.
          </p>
        </div>

        {/* Secțiunea de Pași cu Imaginile Tale */}
        <section className="flex flex-col gap-16">
          {kitSteps.map((item, idx) => (
            <div 
              key={idx}
              className={`flex flex-col ${idx % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"} gap-10 items-center border border-white/[0.04] bg-white/[0.01] backdrop-blur-xl rounded-[26px] p-6 lg:p-8 shadow-[0_12px_40px_-15px_rgba(0,0,0,0.6)]`}
            >
              {/* Containerul pentru poza ta reală */}
              <div className="w-full lg:w-1/2 aspect-video bg-[#14151B] border border-white/[0.06] rounded-[18px] overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-t from-[#0D0E12]/50 via-transparent to-transparent z-10 pointer-events-none transition-opacity group-hover:opacity-30" />
                
                <img 
                  src={item.imgSrc} 
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                
                {/* Text ajutător dacă poza încă nu e pusă în public/ */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 pointer-events-none">
                  <span className="aw-nav-mono text-[9px] uppercase tracking-widest text-[#4FACFE] opacity-40">iMIDI Accordion Tech_{item.step}</span>
                  <span className="text-[10px] text-[#52525B] mt-1">Poza ta cu instalarea pe acordeon</span>
                </div>
              </div>

              {/* Text tehnic și pași */}
              <div className="w-full lg:w-1/2 flex flex-col justify-center px-2">
                <div className="flex items-center gap-3 mb-4">
                  <span className="aw-nav-display font-black text-3xl bg-clip-text text-transparent bg-gradient-to-r from-[#00F2FE] to-[#4FACFE] opacity-90">
                    {item.step}
                  </span>
                  <span className="aw-nav-mono text-[9px] tracking-widest uppercase text-[#9B51E0] bg-[#9B51E0]/10 border border-[#9B51E0]/20 px-2.5 py-0.5 rounded-md font-bold">
                    {item.badge}
                  </span>
                </div>
                
                <h3 className="aw-nav-display text-xl font-bold tracking-tight text-white mb-3">
                  {item.title}
                </h3>
                
                <p className="aw-nav-mono text-[11px] text-[#8E9AA8] leading-relaxed mb-6">
                  {item.desc}
                </p>

                {/* Status Indicator */}
                <div className="flex items-center gap-2 border border-white/[0.04] bg-[#111216] px-3 py-2 rounded-xl w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00F2FE] shadow-[0_0_6px_#00F2FE]" />
                  <span className="aw-nav-mono text-[9px] text-[#A1A1AA] uppercase tracking-wide">
                    Detecție senzor activă
                  </span>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Buton de finalizare */}
        <div className="flex justify-center mt-20">
          <Link
            href="/"
            className="group px-6 h-11 rounded-full border border-white/[0.08] bg-white/[0.02] backdrop-blur-md flex items-center justify-center gap-3 transition-all duration-300 hover:border-[#00F2FE]/40 hover:bg-[#00F2FE]/10 active:scale-95"
          >
            <span className="aw-nav-mono text-xs uppercase tracking-widest text-[#8E9AA8] group-hover:text-white transition-colors">
              Deschide Aplicația & Testează Sunetul
            </span>
            <svg
              xmlns="http://w3.org"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              className="w-3.5 h-3.5 text-[#8E9AA8] group-hover:text-[#00F2FE] group-hover:translate-x-0.5 transition-all"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </Link>
        </div>

      </main>
    </div>
  );
}
