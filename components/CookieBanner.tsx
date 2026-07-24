"use client";

import React, { useState, useEffect } from "react";

interface CookieSettings {
  essential: boolean;
  midiAndPresets: boolean;
  mediaUpload: boolean;
  analytics: boolean;
}

const COOKIE_KEY = "imidi_cookies_preferences";

export default function CookieBanner() {
  const [isOpen, setIsOpen] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [settings, setSettings] = useState<CookieSettings>({
    essential: true,
    midiAndPresets: true,
    mediaUpload: true,
    analytics: false,
  });

  useEffect(() => {
    const savedConsent = localStorage.getItem(COOKIE_KEY);
    if (!savedConsent) return void setTimeout(() => setIsOpen(true), 1200);
    try {
      const parsedSettings = JSON.parse(savedConsent);
      setSettings(parsedSettings);
      applyCookieLogic(parsedSettings);
    } catch (e) { setIsOpen(true); }
  }, []);

  const applyCookieLogic = (currentSettings: CookieSettings) => {
    const hasGtag = typeof window !== "undefined" && (window as any).gtag;
    if (currentSettings.analytics) {
      if (hasGtag) (window as any).gtag("consent", "update", { analytics_storage: "granted" });
      window.dispatchEvent(new CustomEvent("imidi_analytics_allowed"));
    } else {
      if (hasGtag) (window as any).gtag("consent", "update", { analytics_storage: "denied" });
      window.dispatchEvent(new CustomEvent("imidi_analytics_blocked"));
    }
    if (currentSettings.midiAndPresets) window.dispatchEvent(new CustomEvent("imidi_audio_engine_ready"));
  };

  const savePreferences = (finalSettings: CookieSettings) => {
    localStorage.setItem(COOKIE_KEY, JSON.stringify(finalSettings));
    applyCookieLogic(finalSettings);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 left-6 right-6 md:right-auto md:max-w-[420px] w-auto z-50 animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
      {/* Premium Cyber/Studio Container */}
      <div className="relative overflow-hidden bg-black/90 backdrop-blur-2xl border border-white/[0.08] rounded-[24px] p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] text-white">
        
        {/* Decorative Abstract Glows */}
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-[#B4592F]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-[#25D366]/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header with Digital Badge */}
        <div className="relative flex flex-col gap-3">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 bg-white/[0.06] border border-white/[0.04] px-3 py-1.5 rounded-full">
              
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300 font-mono">
                Cookie Preferences
              </span>
            </div>
            <span className="text-xl select-none filter drop-shadow-[0_0_8px_rgba(180,89,47,0.5)]">🍪</span>
          </div>
          
          <div className="flex flex-col gap-1.5 mt-1">
            <h3 className="text-lg font-black tracking-tight bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
              Optimize your iMIDI app .
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed font-normal">
              We deploy strict analytical and processing tokens to safely render MIDI structures, parse synth configurations, and accelerate asset staging.
            </p>
          </div>
        </div>

        {/* Extensible Preferences Panel */}
        {showPreferences && (
          <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-4 flex flex-col gap-3.5 my-4 animate-in fade-in slide-in-from-top-3 duration-300">
            
            {/* Core Engine */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  Core Engine
                  <span className="text-[9px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded font-mono font-medium">REQUIRED</span>
                </span>
                <span className="text-[11px] text-gray-400/70 leading-normal">
                  Secures your encryption nodes, auth sessions, and workspace persistence tokens.
                </span>
              </div>
              <div className="w-4 h-4 rounded border border-white/20 bg-white/10 flex items-center justify-center mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#B4592F]" />
              </div>
            </div>

            <div className="h-[1px] bg-white/[0.06]" />

            {/* MIDI Node Access */}
            <div 
              className="flex items-start justify-between gap-3 cursor-pointer group"
              onClick={() => setSettings({ ...settings, midiAndPresets: !settings.midiAndPresets })}
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-white transition-colors group-hover:text-[#B4592F]">MIDI & Synth Parsing</span>
                <span className="text-[11px] text-gray-400/70 leading-normal">
                  Enables instantaneous web audio pre-listening, synth mapping, and multi-track telemetry.
                </span>
              </div>
              <input 
                type="checkbox" 
                checked={settings.midiAndPresets} 
                onChange={() => {}} 
                className="w-4 h-4 rounded border-white/20 bg-black text-[#B4592F] focus:ring-[#B4592F] cursor-pointer accent-[#B4592F] mt-1" 
              />
            </div>

            <div className="h-[1px] bg-white/[0.06]" />

            {/* Image Upload Stage */}
            <div 
              className="flex items-start justify-between gap-3 cursor-pointer group"
              onClick={() => setSettings({ ...settings, mediaUpload: !settings.mediaUpload })}
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-white transition-colors group-hover:text-[#B4592F]">Media Upload Sandbox</span>
                <span className="text-[11px] text-gray-400/70 leading-normal">
                  Caches uploaded artwork and pack covers locally for blazing fast image preprocessing before deployment.
                </span>
              </div>
              <input 
                type="checkbox" 
                checked={settings.mediaUpload} 
                onChange={() => {}} 
                className="w-4 h-4 rounded border-white/20 bg-black text-[#B4592F] focus:ring-[#B4592F] cursor-pointer accent-[#B4592F] mt-1" 
              />
            </div>

            <div className="h-[1px] bg-white/[0.06]" />

            {/* Performance Analytics */}
            <div 
              className="flex items-start justify-between gap-3 cursor-pointer group"
              onClick={() => setSettings({ ...settings, analytics: !settings.analytics })}
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-white transition-colors group-hover:text-[#B4592F]">DAW Network Analytics</span>
                <span className="text-[11px] text-gray-400/70 leading-normal">
                  Anonymously samples infrastructure packet speeds to calibrate optimal content delivery network routes.
                </span>
              </div>
              <input 
                type="checkbox" 
                checked={settings.analytics} 
                onChange={() => {}} 
                className="w-4 h-4 rounded border-white/20 bg-black text-[#B4592F] focus:ring-[#B4592F] cursor-pointer accent-[#B4592F] mt-1" 
              />
            </div>

          </div>
        )}

        {/* Premium Action Interfaces */}
        <div className="flex flex-col gap-2.5 w-full mt-5">
          {showPreferences ? (
            <button
              onClick={() => savePreferences(settings)}
              className="w-full text-center text-xs font-bold text-black bg-white hover:bg-gray-100 py-3.5 rounded-xl transition-all shadow-lg cursor-pointer transform active:scale-95"
            >
              Commit selected preferences
            </button>
          ) : (
            <div className="flex items-center gap-2.5 w-full">
              <button
                onClick={() => savePreferences({ essential: true, midiAndPresets: false, mediaUpload: false, analytics: false })}
                className="flex-1 text-center text-xs font-bold text-gray-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] py-3.5 rounded-xl transition-all border border-white/[0.02] cursor-pointer transform active:scale-95"
              >
                Reject all
              </button>
              <button
                onClick={() => savePreferences({ essential: true, midiAndPresets: true, mediaUpload: true, analytics: true })}
                className="flex-1 text-center text-xs font-bold text-white bg-[#B4592F] hover:bg-[#964723] py-3.5 rounded-xl transition-all shadow-[0_4px_20px_rgba(180,89,47,0.3)] hover:scale-[1.02] cursor-pointer transform active:scale-95"
              >
                Accept all
              </button>
            </div>
          )}

          <button
            onClick={() => setShowPreferences(!showPreferences)}
            className="w-full text-center text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors py-1 mt-1 cursor-pointer font-mono"
          >
            {showPreferences ? "[ Collapse Preferences ]" : "[ Configure Layout Options ]"}
          </button>
        </div>

      </div>
    </div>
  );
}
