'use client';

import { useState, useEffect } from "react";

// ============================================================================
// CONFIG — editează aici
// ============================================================================

// Program de lucru — zile 1=Luni ... 7=Duminică, ore în format 24h, ora locală a browserului
const BUSINESS_HOURS = {
  days: [1, 2, 3, 4, 5], // Luni–Vineri
  startHour: 9,
  endHour: 18,
};

// Numerele/departamentele disponibile pe WhatsApp.
// Acum e doar unul ("unu acum"), dar structura suportă oricâte —
// adaugă pur și simplu încă un obiect în array când ai al doilea număr.
const DEPARTMENTS = [
  {
    id: "general",
    label: "General Support",
    sublabel: "TS4X, i-volution, MyCloud",
    number: "40765354998", // fără '+' sau spații
    message: "Hi! I have a question about iMIDI / TS4X.",
  },
  // { id: "sales", label: "Sales", sublabel: "Pricing & licenses", number: "40700000000", message: "Hi! I'd like info about pricing." },
];

const BOTTOM_OFFSET = "bottom-23 sm:bottom-14";

// ============================================================================

function getBusinessStatus() {
  const now = new Date();
  const day = now.getDay() === 0 ? 7 : now.getDay(); // JS: 0=Duminică → normalizăm la 7
  const hour = now.getHours() + now.getMinutes() / 60;

  const isWorkingDay = BUSINESS_HOURS.days.includes(day);
  const isOpen = isWorkingDay && hour >= BUSINESS_HOURS.startHour && hour < BUSINESS_HOURS.endHour;

  const hh = (n: number) => `${String(n).padStart(2, "0")}:00`;

  return {
    isOpen,
    label: isOpen ? "Online now" : "Currently offline",
    hoursText: `Mon–Fri, ${hh(BUSINESS_HOURS.startHour)}–${hh(BUSINESS_HOURS.endHour)}`,
  };
}

type Props = {
  /** "right" (default) or "left" */
  position?: "left" | "right";
};

export default function WhatsAppWidget({ position = "right" }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(DEPARTMENTS[0]?.id ?? "");

  // "Tick" — forțează un re-render din când în când, ca statusul (calculat mai jos,
  // direct din ora curentă) să rămână corect fără să depindem de o valoare stocată în state.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Calculat DIRECT la fiecare randare — nu mai există risc de valoare "înghețată"
  // rămasă din momentul montării componentei sau dintr-un hot-reload vechi.
  const status = getBusinessStatus();

  const selected = DEPARTMENTS.find((d) => d.id === selectedId) ?? DEPARTMENTS[0];
  const waHref = selected
    ? `https://wa.me/${selected.number}?text=${encodeURIComponent(selected.message)}`
    : "#";

  const sideClass = position === "left" ? "left-4 sm:left-6" : "right-4 sm:right-6";
  const panelAlign = position === "left" ? "items-start" : "items-end";
  // Pe mobil panoul e full-screen (inset-0), de la sm: în sus devine card flotant ancorat
  const panelPosition =
    position === "left"
      ? "inset-0 sm:inset-auto sm:left-6 sm:bottom-14"
      : "inset-0 sm:inset-auto sm:right-6 sm:bottom-14";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .wa-font { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }

        @keyframes wa-pop { from { opacity: 0; transform: translateY(16px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes wa-ring { 0% { transform: scale(0.85); opacity: 0.7; } 100% { transform: scale(1.7); opacity: 0; } }

        .wa-panel { animation: wa-pop 0.25s cubic-bezier(0.16,1,0.3,1) forwards; }
        .wa-pingring { animation: wa-ring 2s cubic-bezier(0,0,0.2,1) infinite; }
      `}</style>

      {/* ============================= FULL CHAT PANEL ============================= */}
      {open && (
        <div
          className={`wa-panel wa-font fixed z-[59] ${panelPosition} flex flex-col ${panelAlign} w-full h-full sm:w-[calc(100vw-2rem)] sm:max-w-[360px] sm:h-[min(75vh,540px)]`}
        >
          <div className="relative w-full h-full rounded-none sm:rounded-2xl bg-white border-0 sm:border sm:border-black/[0.08] shadow-none sm:shadow-[0_20px_50px_-14px_rgba(0,0,0,0.35)] flex flex-col overflow-hidden">

            {/* Header — verde WhatsApp mai închis */}
            <div className="shrink-0 bg-[#128C7E] px-4 py-4 flex items-start justify-between" style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" className="w-5.5 h-5.5 fill-[#128C7E]">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347z" />
                    <path d="M12.001 2c-5.514 0-9.988 4.474-9.988 9.988 0 1.76.462 3.482 1.34 4.998L2 22l5.146-1.34a9.96 9.96 0 0 0 4.855 1.238h.004c5.514 0 9.987-4.474 9.987-9.988C21.992 6.474 17.518 2 12.001 2zm0 18.16h-.003a8.155 8.155 0 0 1-4.163-1.14l-.299-.177-3.056.796.816-2.98-.194-.306a8.15 8.15 0 0 1-1.253-4.365c0-4.505 3.667-8.171 8.176-8.171 2.184 0 4.238.851 5.782 2.396a8.12 8.12 0 0 1 2.393 5.787c-.002 4.505-3.668 8.16-8.199 8.16z" />
                  </svg>
                </div>
                <div className="pt-0.5">
                  <div className="text-white text-sm font-semibold leading-tight">iMIDI</div>
                  <div className="text-white/90 text-xs flex items-center gap-1.5 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${status.isOpen ? "bg-white" : "bg-white/50"}`} />
                    {status.label}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="w-7 h-7 rounded-full flex items-center justify-center text-white/90 hover:bg-white/15 transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            {/* Business hours strip */}
            <div className={`shrink-0 px-4 py-2 text-[11px] flex items-center justify-between border-b ${status.isOpen ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-amber-50 border-amber-100 text-amber-700"}`}>
              <span>{status.isOpen ? "We usually reply in a few minutes" : "We'll reply as soon as we're back"}</span>
              <span className="font-medium">{status.hoursText}</span>
            </div>

            {/* Body — mesaje + selectare departament */}
            <div className="flex-1 overflow-y-auto bg-[#EFEAE2] px-4 py-4 space-y-4">
              <div className="max-w-[85%] bg-white px-3.5 py-2.5 rounded-xl rounded-tl-sm shadow-sm text-[13px] leading-relaxed text-[#111]">
                Hi 👋 How can we help? Pick a topic below and we'll take you straight to WhatsApp.
              </div>

              {/* Selector de departament — un singur item acum, gata de extindere */}
              <div className="space-y-2">
                {DEPARTMENTS.map((dept) => {
                  const isSelected = dept.id === selectedId;
                  return (
                    <button
                      key={dept.id}
                      onClick={() => setSelectedId(dept.id)}
                      className={`w-full text-left px-3.5 py-3 rounded-xl border transition-colors flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-white border-[#25D366] shadow-sm"
                          : "bg-white/60 border-black/[0.06] hover:bg-white"
                      }`}
                    >
                      <div>
                        <div className="text-[13px] font-semibold text-[#111]">{dept.label}</div>
                        <div className="text-[11px] text-black/50">{dept.sublabel}</div>
                      </div>
                      <span
                        className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? "border-[#25D366]" : "border-black/20"
                        }`}
                      >
                        {isSelected && <span className="w-2 h-2 rounded-full bg-[#25D366]" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer — CTA legat de statusul programului */}
            <div className="shrink-0 bg-white border-t border-black/[0.06] p-3">
              {status.isOpen ? (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-11 rounded-xl bg-[#25D366] hover:bg-[#20BD5C] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347z" />
                    <path d="M12.001 2c-5.514 0-9.988 4.474-9.988 9.988 0 1.76.462 3.482 1.34 4.998L2 22l5.146-1.34a9.96 9.96 0 0 0 4.855 1.238h.004c5.514 0 9.987-4.474 9.987-9.988C21.992 6.474 17.518 2 12.001 2zm0 18.16h-.003a8.155 8.155 0 0 1-4.163-1.14l-.299-.177-3.056.796.816-2.98-.194-.306a8.15 8.15 0 0 1-1.253-4.365c0-4.505 3.667-8.171 8.176-8.171 2.184 0 4.238.851 5.782 2.396a8.12 8.12 0 0 1 2.393 5.787c-.002 4.505-3.668 8.16-8.199 8.16z" />
                  </svg>
                  Start chat on WhatsApp
                </a>
              ) : (
                <>
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="w-full h-11 rounded-xl bg-black/[0.06] text-black/35 text-sm font-semibold flex items-center justify-center gap-2 cursor-not-allowed select-none"
                  >
                    Currently offline
                  </button>
                  <p className="text-center text-[10px] text-black/40 mt-1.5">
                    Chat unavailable right now — back {status.hoursText}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================= FLOATING BUTTON — icon normal ============================= */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Chat on WhatsApp"
          className={`fixed z-[59] ${BOTTOM_OFFSET} ${sideClass} w-14 h-14 rounded-full bg-[#25D366] flex items-center justify-center text-white shadow-[0_8px_24px_-6px_rgba(37,211,102,0.55)] transition-transform duration-300 hover:scale-105 active:scale-95`}
        >
          <span className="wa-pingring absolute inset-0 rounded-full border-2 border-[#25D366]/50" />
          <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white relative z-10">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347z" />
            <path d="M12.001 2c-5.514 0-9.988 4.474-9.988 9.988 0 1.76.462 3.482 1.34 4.998L2 22l5.146-1.34a9.96 9.96 0 0 0 4.855 1.238h.004c5.514 0 9.987-4.474 9.987-9.988C21.992 6.474 17.518 2 12.001 2zm0 18.16h-.003a8.155 8.155 0 0 1-4.163-1.14l-.299-.177-3.056.796.816-2.98-.194-.306a8.15 8.15 0 0 1-1.253-4.365c0-4.505 3.667-8.171 8.176-8.171 2.184 0 4.238.851 5.782 2.396a8.12 8.12 0 0 1 2.393 5.787c-.002 4.505-3.668 8.16-8.199 8.16z" />
          </svg>
        </button>
      )}
    </>
  );
}