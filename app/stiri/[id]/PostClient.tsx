/**
 * app/stiri/[id]/PostClient.tsx
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase";

interface Reply {
  id: string;
  post_id: string;
  user_email: string;
  content: string;
  created_at: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  user_email: string;
  created_at: string;
  replies: Reply[];
}

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleString("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function PostClient({ initialPost }: { initialPost: Post }) {
  const [user, setUser] = useState<any>(null);
  const [replies, setReplies] = useState<Reply[]>(initialPost.replies);
  const [replyContent, setReplyContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) =>
      setUser(session?.user || null)
    );
  }, []);

  const handleCreateReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !replyContent.trim() || sending) return;

    setSending(true);
    const { data, error } = await supabase
      .from("forum_replies")
      .insert([
        {
          post_id: initialPost.id,
          content: replyContent.trim(),
          user_id: user.id,
          user_email: user.email,
        },
      ])
      .select()
      .single();
    setSending(false);

    if (data && !error) {
      setReplies((prev) => [...prev, data as Reply]);
      setReplyContent("");
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/stiri/${initialPost.id}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: initialPost.title, url: shareUrl });
      } catch {}
    } else {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-[#f8f9fa] text-[#202124] min-h-screen flex flex-col antialiased selection:bg-blue-100">
      <Navbar />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-20">
        <Link
          href="/stiri"
          className="inline-flex items-center text-sm font-medium text-[#1a73e8] hover:underline mb-6"
        >
          ← Înapoi la știri
        </Link>

        {/* Post */}
        <article className="rounded-2xl border border-[#dadce0] bg-white p-5 sm:p-8 shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5 text-[13px] text-[#5f6368] mb-3">
            <span className="font-medium text-[#202124]">
              {initialPost.user_email}
            </span>
            <span className="text-[#dadce0]">•</span>
            <time dateTime={initialPost.created_at}>
              {formatDate(initialPost.created_at)}
            </time>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#202124] leading-snug">
            {initialPost.title}
          </h1>

          <p className="mt-4 text-[16px] text-[#3c4043] leading-relaxed whitespace-pre-wrap break-words">
            {initialPost.content}
          </p>

          <div className="mt-6 pt-4 border-t border-[#f1f3f4] flex justify-end">
            <button
              onClick={handleShare}
              className="text-sm font-medium text-[#5f6368] hover:text-[#202124]"
            >
              {copied ? "✓ Link copiat" : "Distribuie"}
            </button>
          </div>
        </article>

        {/* Replies */}
        <section className="mt-8">
          <h2 className="text-lg font-medium text-[#202124] mb-4">
            {replies.length}{" "}
            {replies.length === 1 ? "răspuns" : "răspunsuri"}
          </h2>

          <div className="space-y-3">
            {replies.length === 0 && (
              <p className="text-sm text-[#5f6368]">
                Niciun răspuns încă.
              </p>
            )}
            {replies.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-[#dadce0] bg-white p-4 sm:p-5"
              >
                <div className="flex items-center gap-2 text-[12px] text-[#5f6368] mb-1.5">
                  <span className="font-medium text-[#202124]">
                    {r.user_email}
                  </span>
                  <span>•</span>
                  <time dateTime={r.created_at}>{formatDate(r.created_at)}</time>
                </div>
                <p className="text-[15px] text-[#3c4043] leading-relaxed whitespace-pre-wrap break-words">
                  {r.content}
                </p>
              </div>
            ))}
          </div>

          {/* Reply form */}
          <div id="raspuns" className="mt-6 scroll-mt-28">
            {user ? (
              <form
                onSubmit={handleCreateReply}
                className="rounded-2xl border border-[#dadce0] bg-white p-4 sm:p-5 space-y-3 shadow-sm"
              >
                <textarea
                  rows={3}
                  placeholder="Scrie un răspuns..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  className="w-full bg-[#f8f9fa] border border-[#dadce0] rounded-xl px-4 py-3 text-sm text-[#202124] placeholder-[#9aa0a6] focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] transition-colors resize-none"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={sending || !replyContent.trim()}
                    className="bg-[#1a73e8] text-white text-sm font-medium px-6 h-10 rounded-full hover:bg-[#1765cc] transition-colors disabled:opacity-50"
                  >
                    {sending ? "Se trimite..." : "Trimite"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="rounded-2xl border border-[#dadce0] bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <p className="text-sm text-[#5f6368]">
                  Autentifică-te pentru a răspunde.
                </p>
                <Link
                  href="/login"
                  className="bg-[#1a73e8] text-white px-5 h-10 rounded-full font-medium text-sm flex items-center justify-center hover:bg-[#1765cc] transition-colors shrink-0"
                >
                  Autentificare
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}