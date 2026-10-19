/**
 * app/stiri/ForumClient.tsx
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

export default function StiriClient({ initialPosts }: { initialPosts: Post[] }) {
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>(initialPosts || []);
  const [loading] = useState(false);

  const [newPost, setNewPost] = useState({ title: "", content: "" });
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [sharedPostId, setSharedPostId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) =>
      setUser(session?.user || null)
    );

    (async () => {
      const { data: p } = await supabase
        .from("forum_posts")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: r } = await supabase
        .from("forum_replies")
        .select("*")
        .order("created_at", { ascending: true });

      setPosts(
        (p || []).map((post: any) => ({
          ...post,
          replies: (r || []).filter((rep: any) => rep.post_id === post.id),
        }))
      );
 
    })();
  }, []);

  const currentPosts = posts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(posts.length / itemsPerPage);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.title || !newPost.content) return;

    const { data, error } = await supabase
      .from("forum_posts")
      .insert([
        {
          ...newPost,
          user_id: user.id,
          user_email: user.email,
        },
      ])
      .select()
      .single();

    if (data && !error) {
      setPosts([{ ...data, replies: [] }, ...posts]);
      setNewPost({ title: "", content: "" });
      setCurrentPage(1);
    }
  };

  const handleCreateReply = async (e: React.FormEvent, postId: string) => {
    e.preventDefault();
    if (!replyContent.trim()) return;

    const { data, error } = await supabase
      .from("forum_replies")
      .insert([
        {
          post_id: postId,
          content: replyContent,
          user_id: user.id,
          user_email: user.email,
        },
      ])
      .select()
      .single();

    if (data && !error) {
      setPosts(
        posts.map((p) =>
          p.id === postId
            ? { ...p, replies: [...p.replies, data as Reply] }
            : p
        )
      );
      setReplyContent("");
      setActiveReplyId(null);
    }
  };

  const handleShare = async (post: Post) => {
    const shareUrl = `${window.location.origin}/stiri?post=${post.id}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: post.title, url: shareUrl });
      } catch {}
    } else {
      navigator.clipboard.writeText(shareUrl);
      setSharedPostId(post.id);
      setTimeout(() => setSharedPostId(null), 2000);
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    );

    if (diffInHours < 1) return "Acum câteva minute";
    if (diffInHours < 24) return `Acum ${diffInHours} ore`;
    if (diffInHours < 48) return "Ieri";
    return date.toLocaleDateString("ro-RO", {
      day: "numeric",
      month: "short",
    });
  };

  return (
    <div className="bg-[#f8f9fa] text-[#202124] min-h-screen flex flex-col antialiased selection:bg-blue-100">
      <Navbar />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 pt-28 sm:pt-32 pb-20">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#202124]">
            Știri
          </h1>
          <p className="text-[#5f6368] mt-2 text-sm sm:text-base">
            Ultimele discuții și actualizări din comunitatea iMIDI
          </p>
        </div>

        {/* Create Post */}
        {!user ? (
          <div className="mb-8 rounded-2xl border border-[#dadce0] bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <p className="text-sm text-[#5f6368]">
              Ești în modul doar-citire. Autentifică-te pentru a publica.
            </p>
            <Link
              href="/login"
              className="bg-[#1a73e8] text-white px-5 h-10 rounded-full font-medium text-sm flex items-center justify-center hover:bg-[#1765cc] transition-colors shrink-0"
            >
              Autentificare
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleCreatePost}
            className="mb-8 rounded-2xl border border-[#dadce0] bg-white p-5 sm:p-6 space-y-4 shadow-sm"
          >
            <div className="flex items-center gap-2 text-sm text-[#5f6368]">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>
                Publici ca{" "}
                <span className="font-medium text-[#202124]">
                  {user.email}
                </span>
              </span>
            </div>

            <input
              type="text"
              placeholder="Titlu știre / discuție..."
              value={newPost.title}
              onChange={(e) =>
                setNewPost({ ...newPost, title: e.target.value })
              }
              className="w-full h-11 bg-[#f8f9fa] border border-[#dadce0] rounded-xl px-4 text-sm text-[#202124] placeholder-[#9aa0a6] focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] transition-colors"
            />

            <textarea
              placeholder="Scrie conținutul..."
              rows={3}
              value={newPost.content}
              onChange={(e) =>
                setNewPost({ ...newPost, content: e.target.value })
              }
              className="w-full bg-[#f8f9fa] border border-[#dadce0] rounded-xl px-4 py-3 text-sm text-[#202124] placeholder-[#9aa0a6] focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] transition-colors resize-none"
            />

            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-[#1a73e8] text-white text-sm font-medium px-6 h-10 rounded-full hover:bg-[#1765cc] transition-colors"
              >
                Publică
              </button>
            </div>
          </form>
        )}

        {/* Feed */}
        <div className="space-y-4">
          {loading ? (
            <div className="py-20 text-center">
              <p className="text-sm text-[#5f6368] animate-pulse">
                Se încarcă știrile...
              </p>
            </div>
          ) : currentPosts.length === 0 ? (
            <div className="py-20 text-center text-[#5f6368] text-sm">
              Nicio știre încă. Fii primul care publică!
            </div>
          ) : (
            currentPosts.map((post) => (
              <article
                key={post.id}
                className="group relative rounded-2xl border border-[#dadce0] bg-white hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                <div className="p-5 sm:p-6">
                  {/* Meta */}
                  <div className="flex items-center gap-2.5 text-[13px] text-[#5f6368] mb-2.5">
                    <span className="font-medium text-[#202124] truncate max-w-[160px]">
                      {post.user_email}
                    </span>
                    <span className="text-[#dadce0]">•</span>
                    <time dateTime={post.created_at}>
                      {formatRelativeTime(post.created_at)}
                    </time>
                    {post.replies.length > 0 && (
                      <>
                        <span className="text-[#dadce0]">•</span>
                        <span>
                          {post.replies.length}{" "}
                          {post.replies.length === 1 ? "răspuns" : "răspunsuri"}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Title */}
                  <h2 className="text-[18px] sm:text-[20px] font-medium text-[#202124] leading-snug group-hover:text-[#1a73e8] transition-colors">
                    {post.title}
                  </h2>

                  {/* Content */}
                  <p className="mt-2 text-[15px] text-[#5f6368] leading-relaxed line-clamp-3">
                    {post.content}
                  </p>

                  {/* Replies preview */}
                  {post.replies.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-[#f1f3f4] space-y-3.5">
                      {post.replies.slice(0, 2).map((r) => (
                        <div key={r.id}>
                          <div className="flex items-center gap-2 text-[12px] text-[#5f6368] mb-1">
                            <span className="font-medium text-[#202124]">
                              {r.user_email}
                            </span>
                            <span>•</span>
                            <span>{formatRelativeTime(r.created_at)}</span>
                          </div>
                          <p className="text-[14px] text-[#3c4043] leading-relaxed">
                            {r.content}
                          </p>
                        </div>
                      ))}
                      {post.replies.length > 2 && (
                        <p className="text-[13px] text-[#1a73e8] font-medium">
                          + {post.replies.length - 2} răspunsuri în plus
                        </p>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-5 flex items-center justify-between">
                    {user ? (
                      activeReplyId === post.id ? (
                        <form
                          onSubmit={(e) => handleCreateReply(e, post.id)}
                          className="flex items-center gap-2 w-full"
                        >
                          <input
                            type="text"
                            autoFocus
                            placeholder="Scrie un răspuns..."
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            className="flex-1 h-10 bg-[#f8f9fa] border border-[#dadce0] rounded-full px-4 text-sm text-[#202124] focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]"
                          />
                          <button
                            type="submit"
                            className="bg-[#1a73e8] text-white text-sm font-medium h-10 px-5 rounded-full hover:bg-[#1765cc]"
                          >
                            Trimite
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveReplyId(null)}
                            className="text-sm text-[#5f6368] px-2 hover:text-[#202124]"
                          >
                            Anulează
                          </button>
                        </form>
                      ) : (
                        <div className="flex items-center gap-5 w-full">
                          <button
                            onClick={() => setActiveReplyId(post.id)}
                            className="text-sm font-medium text-[#1a73e8] hover:underline"
                          >
                            Răspunde
                          </button>
                          <button
                            onClick={() => handleShare(post)}
                            className="text-sm font-medium text-[#5f6368] hover:text-[#202124] ml-auto"
                          >
                            {sharedPostId === post.id
                              ? "✓ Copiat"
                              : "Distribuie"}
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-sm text-[#9aa0a6]">
                          Doar citire
                        </span>
                        <button
                          onClick={() => handleShare(post)}
                          className="text-sm font-medium text-[#5f6368] hover:text-[#202124]"
                        >
                          {sharedPostId === post.id
                            ? "✓ Link copiat"
                            : "Distribuie"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-between pt-6">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className="h-10 px-5 rounded-full border border-[#dadce0] bg-white text-sm font-medium text-[#202124] disabled:opacity-40 hover:bg-[#f1f3f4] transition-all"
            >
              ← Anterior
            </button>

            <span className="text-sm text-[#5f6368]">
              Pagina {currentPage} din {totalPages}
            </span>

            <button
              disabled={currentPage === totalPages}
              onClick={() =>
                setCurrentPage((p) => Math.min(p + 1, totalPages))
              }
              className="h-10 px-5 rounded-full border border-[#dadce0] bg-white text-sm font-medium text-[#202124] disabled:opacity-40 hover:bg-[#f1f3f4] transition-all"
            >
              Următor →
            </button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}