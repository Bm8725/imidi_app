'use client';

import React from 'react';
import { WbnkCompileData } from '@/lib/wbnk-compiler';

interface OptionsProps {
  bankData: WbnkCompileData;
  setBankData: React.Dispatch<React.SetStateAction<WbnkCompileData>>;
  disabled: boolean;
}

export default function WbnkCompilerOptions({ bankData, setBankData, disabled }: OptionsProps) {
  
  const handleAuthorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBankData(prev => ({
      ...prev,
      textMeta: {
        ...prev.textMeta,
        author: e.target.value
      }
    }));
  };

  const handleInstrumentNameChange = (index: number, newName: string) => {
    setBankData(prev => {
      const updatedInstrumente = [...prev.instrumente];
      if (updatedInstrumente[index]) {
        updatedInstrumente[index] = { ...updatedInstrumente[index], name: newName };
      }
      return { ...prev, instrumente: updatedInstrumente };
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
      
      {/* Modul Global Meta */}
      <div style={{ backgroundColor: '#050505', border: '1px solid #111111', padding: '25px', borderRadius: '8px' }}>
        <h4 style={{ margin: '0 0 20px 0', fontSize: '14px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: '#888888' }}>
          01 // Global Metadata Container (META)
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            System Author / Encryption Owner
          </label>
          <input 
            type="text" 
            value={bankData.textMeta?.author || ''} 
            onChange={handleAuthorChange}
            disabled={disabled}
            style={{ 
              padding: '12px', 
              borderRadius: '4px', 
              border: '1px solid #1a1a1a', 
              backgroundColor: '#000000', 
              color: '#ffffff',
              fontSize: '14px', 
              width: '100%', 
              maxWidth: '450px',
              outline: 'none',
              fontFamily: 'monospace'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#444444'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#1a1a1a'}
          />
        </div>
      </div>

      {/* Modul Instrumente iMIDI */}
      <div style={{ backgroundColor: '#050505', border: '1px solid #111111', padding: '25px', borderRadius: '8px' }}>
        <h4 style={{ margin: '0 0 20px 0', fontSize: '14px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: '#888888' }}>
          02 // iMIDI Performance Maps (INST)
        </h4>
        
        {bankData.instrumente.map((inst, index) => (
          <div key={index} style={{ backgroundColor: '#000000', padding: '20px', borderRadius: '6px', border: '1px solid #1a1a1a' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '15px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Instrument Descriptor Label (Max 32 Bytes)
              </label>
              <input 
                type="text" 
                maxLength={31} 
                value={inst.name} 
                onChange={(e) => handleInstrumentNameChange(index, e.target.value)}
                disabled={disabled}
                style={{ 
                  padding: '12px', 
                  borderRadius: '4px', 
                  border: '1px solid #1a1a1a', 
                  backgroundColor: '#050505', 
                  color: '#ffffff',
                  fontSize: '14px', 
                  width: '100%', 
                  maxWidth: '350px',
                  outline: 'none'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#444444'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#1a1a1a'}
              />
            </div>
            
            <div style={{ fontSize: '12px', color: '#888888', fontFamily: 'monospace', display: 'flex', gap: '20px', borderTop: '1px solid #111111', paddingTop: '12px' }}>
              <div>FIRST_ZONE_PTR: <span style={{ color: '#ffffff' }}>0x{inst.first_zone.toString(16).toUpperCase()}</span></div>
              <div>ALLOCATED_ZONES: <span style={{ color: '#ffffff' }}>{inst.zone_count}</span></div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
