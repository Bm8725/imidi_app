"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase";
import { AirMidiLink, AirMidiStatus } from "@/lib/AirMidiLink";

export default function AirMidiPage() {
  const [mode, setMode] = useState<"choose" | "sender" | "receiver">("choose");
  const [status, setStatus] = useState<AirMidiStatus>("idle");
  const [roomCode, setRoomCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [detectedDevices, setDetectedDevices] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [scanning, setScanning] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const airMidiRef = useRef<AirMidiLink | null>(null);
  const ledTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Acces permis doar utilizatorilor autentificați
  useEffect(() => {
    let active = true;

    const redirectToLogin = () =>
      router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active) return;
      if (!user) return redirectToLogin();
      setIsLoggedIn(true);
      setCheckingAuth(false);
    });

    // dacă se face logout în alt tab / expiră sesiunea
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        airMidiRef.current?.disconnect();
        setIsLoggedIn(false);
        redirectToLogin();
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const link = new AirMidiLink(supabase);
    airMidiRef.current = link;

    link.onStatusChange = (newStatus) => {
      setStatus(newStatus);
      if (newStatus === "connected") {
        setLoading(false);
        setError("");
      }
      if (newStatus === "disconnected") {
        setLoading(false);
        setError("AirMIDI Link a fost întrerupt.");
      }
    };

    link.onDevicesChange = (names) => setDetectedDevices(names);

    link.onMidiActivity = () => {
      setIsSending(true);
      if (ledTimeout.current) clearTimeout(ledTimeout.current);
      ledTimeout.current = setTimeout(() => setIsSending(false), 80);
    };

    return () => {
      if (ledTimeout.current) clearTimeout(ledTimeout.current);
      link.disconnect();
    };
  }, []);

  // PAS 2: caută adaptorul USB MIDI (utilizatorul e deja logat)
  const scanAdapters = async () => {
    setError("");
    setScanning(true);
    try {
      const names = await airMidiRef.current?.scanInputs();
      setDetectedDevices(names || []);
    } catch (err: any) {
      setError(err.message);
      setMode("choose");
    }
    setScanning(false);
  };

  const handleChooseSender = async () => {
    setMode("sender");
    await scanAdapters();
  };

  // PAS 3: generează codul (doar dacă există adaptor)
  const handleStartBroadcasting = async () => {
    setError("");
    setLoading(true);
    try {
      const code = await airMidiRef.current?.startBroadcasting({ device: "Web iMIDI Hub" });
      if (code) setRoomCode(code);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleConnectAsReceiver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.length < 6) return setError("Cod invalid.");
    setError("");
    setLoading(true);
    try {
      await airMidiRef.current?.connect(inputCode, { device: "Receiver iMIDI" });
    } catch (err: any) {
      setError(err.message);
      setMode("choose");
      setLoading(false);
    }
  };

  const handleReset = () => {
    airMidiRef.current?.disconnect();
    setMode("choose");
    setRoomCode("");
    setInputCode("");
    setError("");
    setLoading(false);
    setDetectedDevices([]);
  };

  if (checkingAuth || !isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EEF2FF]">
        <span className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-tr from-[#E0E7FF] via-[#EEF2FF] to-[#F5F3FF] text-[#111111] min-h-screen flex flex-col antialiased relative overflow-x-hidden corp-sans">
      <div className="absolute top-[-10%] right-[-5%] w-[400px] sm:w-[800px] h-[400px] sm:h-[800px] bg-gradient-to-br from-[#4F46E5]/35 via-[#8B5CF6]/30 to-transparent rounded-full blur-[70px] sm:blur-[110px] pointer-events-none z-0 animate-pulse duration-[5000ms]" />

      <Navbar />

      <div className="bg-white/70 backdrop-blur-md border-b border-[#EAEAEA] pt-32 pb-8 relative z-10">
        <div className="max-w-xl mx-auto px-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-500 via-pink-500 via-red-500 via-yellow-500 via-green-500 to-blue-500 bg-clip-text text-transparent py-1">
              AirMIDI Link
            </h1>
            <p className="text-xs text-[#666666]">Transmisie stabilă hardware-to-hardware.</p>
          </div>
          {status !== "idle" && (
            <span className="text-[10px] corp-mono bg-black/5 px-2 py-1 rounded border border-black/10 uppercase tracking-wider">
              {status}
            </span>
          )}
        </div>
      </div>

      <main className="flex-1 w-full max-w-xl mx-auto px-6 py-10 relative z-10">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 corp-mono">
            Error: {error}
          </div>
        )}

        <div className="bg-white border border-[#EAEAEA] rounded-xl p-6 sm:p-8 shadow-sm">
          {mode === "choose" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={handleChooseSender}
                disabled={loading || scanning}
                className="p-6 bg-[#FAFAFA] border border-[#EAEAEA] hover:border-[#4F46E5] rounded-xl text-center space-y-1 transition-all"
              >
                <span className="text-xl block">🔌</span>
                <span className="text-xs font-semibold text-black block">Transmite prin Adaptor USB</span>
              </button>
              <button
                onClick={() => {
                  setError("");
                  setMode("receiver");
                }}
                className="p-6 bg-[#FAFAFA] border border-[#EAEAEA] hover:border-[#0070F3] rounded-xl text-center space-y-1 transition-all"
              >
                <span className="text-xl block">🔊</span>
                <span className="text-xs font-semibold text-black block">Recepționează ca Terț</span>
              </button>
            </div>
          )}

          {mode === "sender" && status !== "connected" && (
            <div className="text-center space-y-4">
              {/* PAS 2: se caută adaptorul */}
              {scanning && (
                <p className="text-xs text-[#666666]">Se caută adaptorul USB MIDI...</p>
              )}

              {/* adaptor lipsă */}
              {!scanning && !roomCode && detectedDevices.length === 0 && (
                <>
                  <div className="text-[11px] bg-amber-50 border border-amber-100 p-3 rounded-lg text-amber-700 font-medium">
                    Niciun adaptor USB MIDI detectat. Conectează-l la dispozitiv și permite accesul MIDI în
                    browser.
                  </div>
                  <button
                    onClick={scanAdapters}
                    className="h-10 px-4 bg-black text-white text-xs font-semibold rounded-lg"
                  >
                    Caută din nou
                  </button>
                </>
              )}

              {/* adaptor găsit, cod încă negenerat */}
              {!scanning && !roomCode && detectedDevices.length > 0 && (
                <>
                  <div className="text-[11px] bg-emerald-50 border border-emerald-100 p-3 rounded-lg text-emerald-700 font-medium">
                    Adaptor detectat:{" "}
                    <span className="text-black corp-mono">{detectedDevices.join(", ")}</span>
                  </div>
                  <button
                    onClick={handleStartBroadcasting}
                    disabled={loading}
                    className="w-full h-10 bg-black text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                  >
                    {loading ? "Se generează..." : "Generează cod →"}
                  </button>
                </>
              )}

              {/* PAS 3: cod generat */}
              {roomCode && (
                <>
                  <p className="text-xs text-[#666666]">Codul tău de rețea AirMIDI Link:</p>
                  <div className="text-4xl font-mono font-extrabold tracking-widest text-black bg-[#FAFAFA] p-4 rounded-xl border border-[#EAEAEA] shadow-inner">
                    {roomCode}
                  </div>
                  <p className="text-[11px] text-zinc-400">Se așteaptă receptorul...</p>
                </>
              )}

              <button
                onClick={handleReset}
                className="text-xs font-semibold text-zinc-500 hover:text-black transition-all pt-2 block mx-auto"
              >
                ← {roomCode ? "Oprește" : "Înapoi"}
              </button>
            </div>
          )}

          {mode === "receiver" && status !== "connected" && (
            <form onSubmit={handleConnectAsReceiver} className="space-y-4">
              <input
                type="text"
                maxLength={6}
                required
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ""))}
                className="w-full h-12 bg-[#FAFAFA] border border-[#EAEAEA] rounded-lg px-4 text-lg font-mono text-center outline-none focus:bg-white focus:border-[#0070F3]/50"
                placeholder="Introdu codul din 6 cifre al adaptorului"
                disabled={loading}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="h-10 px-4 bg-zinc-100 text-xs font-semibold rounded-lg"
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-10 bg-black text-white text-xs font-semibold rounded-lg"
                >
                  {loading ? "Conectare..." : "Conectează Link →"}
                </button>
              </div>
            </form>
          )}

          {status === "connected" && (
            <div className="text-center space-y-4 py-2">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto text-sm font-bold transition-all duration-100 ${
                  isSending
                    ? "bg-amber-400 text-black scale-110 shadow-lg"
                    : "bg-emerald-50 text-emerald-600"
                }`}
              >
                {isSending ? "⚡" : "🟢"}
              </div>
              <h3 className="text-sm font-semibold text-black">Punte AirMIDI Link Activă</h3>

              {detectedDevices.length > 0 ? (
                <div className="text-[11px] bg-zinc-50 border border-zinc-100 p-2 rounded-lg text-zinc-500 font-medium">
                  {mode === "receiver" ? "Ieșiri MIDI detectate: " : "Hardware detectat: "}
                  <span className="text-black corp-mono">{detectedDevices.join(", ")}</span>
                </div>
              ) : (
                <div className="text-[11px] bg-amber-50 border border-amber-100 p-2 rounded-lg text-amber-700 font-medium">
                  Niciun dispozitiv MIDI detectat. Conectează adaptorul USB și permite accesul MIDI în browser.
                </div>
              )}

              <p className="text-xs text-zinc-400">
                {mode === "receiver"
                  ? "Mesajele MIDI primite sunt trimise către ieșirea MIDI a acestui dispozitiv."
                  : "Datele de la adaptorul tău USB sunt acum trimise direct către receptorul terț."}
              </p>
              <button
                onClick={handleReset}
                className="h-9 px-4 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-100"
              >
                Deconectează
              </button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}