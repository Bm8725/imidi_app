export interface Capabilities {
  browser: string;
  mobile: boolean;
  secure: boolean;
  /** File System Access API: the bank is written straight to the chosen file. */
  directSave: boolean;
  /** Web Audio: sample preview in the editor. */
  audio: boolean;
  /** Web MIDI: connect a keyboard or controller in the Play tab. */
  midi: boolean;
}

export function detectCapabilities(): Capabilities {
  const ua = navigator.userAgent;
  let browser = 'an unknown browser';
  if (/Edg\//.test(ua)) browser = 'Microsoft Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/Firefox\/|FxiOS/.test(ua)) browser = 'Firefox';
  else if (/Chrome\/|CriOS/.test(ua)) browser = 'Google Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';

  const w = window as any;
  return {
    browser,
    mobile: /Android|iPhone|iPad|iPod/i.test(ua),
    secure: window.isSecureContext,
    directSave: typeof w.showSaveFilePicker === 'function',
    audio: typeof (w.AudioContext ?? w.webkitAudioContext) !== 'undefined',
    midi: typeof (navigator as any).requestMIDIAccess === 'function',
  };
}