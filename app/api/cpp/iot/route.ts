import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function GET(): Promise<Response> {
  return new Promise<Response>((resolve) => {
    // Localizăm unde se află fișierul tău C++
    const scriptPath = path.join(process.cwd(), 'cpp_core/iot.cpp');
    
    // Îi spunem serverului să compileze fișierul în /tmp și să îl execute direct
    const command = `g++ ${scriptPath} -o /tmp/iot_bin && /tmp/iot_bin`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        resolve(NextResponse.json({ 
          status: "error", 
          error: stderr || error.message 
        }, { status: 500 }));
        return;
      }
      
      try {
        // Extragem doar obiectul JSON curat din std::cout-ul executabilului tău
        const jsonStart = stdout.indexOf('{');
        const jsonString = stdout.substring(jsonStart);
        const data = JSON.parse(jsonString);
        
        resolve(NextResponse.json(data));
      } catch (parseError) {
        resolve(NextResponse.json({ status: "parse_error", raw: stdout }, { status: 500 }));
      }
    });
  });
}
