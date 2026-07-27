"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RedirectToListing({ id }: { id: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/e-market?id=${id}`);
  }, [id, router]);

  // fallback vizibil o fractiune de secunda / daca JS e dezactivat
  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-[#1C1A16]">
      <div className="text-center space-y-3">
        <p className="text-xs font-mono text-[#9A907C]">Redirect to post...</p>
        <a href={`/e-market?id=${id}`} className="text-xs text-[#B4592F] underline underline-offset-2">
          Click here if not redirected automatically
        </a>
      </div>
    </div>
  );
}