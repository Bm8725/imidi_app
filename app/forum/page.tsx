"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase";

interface Reply { id: string; post_id: string; user_email: string; content: string; created_at: string; }
interface Post { id: string; title: string; content: string; user_email: string; created_at: string; replies: Reply[]; }

export default function ForumPage() {
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState({ title: "", content: "" });
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [sharedPostId, setSharedPostId] = useState<string | null>(null);
  
  // Stări pentru paginare (5 articole per pagină)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user || null));
    const fetchData = async () => {
      const { data: p } = await supabase.from("forum_posts").select("*").order("created_at", { ascending: false });
      const { data: r } = await supabase.from("forum_replies").select("*").order("created_at", { ascending: true });
      setPosts((p || []).map((post: any) => ({ ...post, replies: (r || []).filter((rep: any) => rep.post_id === post.id) })));
      setLoading(false);
    };
    fetchData();
  }, []);

  // Calculul articolelor pentru pagina curentă
  const indexOfLastPost = currentPage * itemsPerPage;
  const indexOfFirstPost = indexOfLastPost - itemsPerPage;
  const currentPosts = posts.slice(indexOfFirstPost, indexOfLastPost);
  const totalPages = Math.ceil(posts.length / itemsPerPage);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.title || !newPost.content) return;
    const { data } = await supabase.from("forum_posts").insert([{ ...newPost, user_id: user.id, user_email: user.email }]).select();
    if (data) { 
      setPosts([{ ...data, replies: [] }, ...posts]); 
      setNewPost({ title: "", content: "" });
      setCurrentPage(1); // Resetăm la prima pagină pentru a vedea postarea nouă
    }
  };

  const handleCreateReply = async (e: React.FormEvent, postId: string) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    const { data } = await supabase.from("forum_replies").insert([{ post_id: postId, content: replyContent, user_id: user.id, user_email: user.email }]).select();
    if (data) {
      setPosts(posts.map((p) => p.id === postId ? { ...p, replies: [...p.replies, data] } : p));
      setReplyContent(""); setActiveReplyId(null);
    }
  };

  const handleShare = async (post: Post) => {
    const shareUrl = `${window.location.origin}/forum?post=${post.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: post.title, text: `Thread: ${post.title}`, url: shareUrl }); } catch {}
    } else {
      navigator.clipboard.writeText(shareUrl);
      setSharedPostId(post.id);
      setTimeout(() => setSharedPostId(null), 2000);
    }
  };

  return (
    <div className="bg-[#FAF9F5] text-[#14181D] min-h-screen flex flex-col antialiased">
      <Navbar />
      <main className="font-sans flex-1 w-full max-w-3xl mx-auto px-4 pt-36 pb-24 space-y-6">
        <div className="border-b border-[#E7E5DB] pb-6 space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight">Forum comunity iMIDI</h1>
          <p className="text-sm text-[#5B5F66] font-light">Discuss MIDI routing, hardware patches, and system logs.</p>
        </div>

        {!user ? (
          <div className="bg-white border border-[#E7E5DB] rounded-2xl p-5 flex items-center justify-between text-xs">
            <p className="text-[#5B5F66]">You are browsing in read-only mode. Authenticate to deploy threads.</p>
            <Link href="/login" className="bg-[#14181D] text-white px-4 py-2 rounded-xl font-medium shrink-0">Sign In →</Link>
          </div>
        ) : (
          <form onSubmit={handleCreatePost} className="bg-white border border-[#E7E5DB] rounded-2xl p-5 space-y-3 shadow-sm">
            <p className="text-xs text-[#5B5F66]">Posting as: <span className="font-semibold text-black">{user.email}</span></p>
            <input type="text" placeholder="Thread Title..." value={newPost.title} onChange={(e) => setNewPost({ ...newPost, title: e.target.value })} className="w-full h-10 bg-[#FAF9F5] border border-[#E7E5DB] rounded-xl px-3 text-sm focus:outline-none focus:border-black" />
            <textarea placeholder="Elaborate your question..." rows={2} value={newPost.content} onChange={(e) => setNewPost({ ...newPost, content: e.target.value })} className="w-full bg-[#FAF9F5] border border-[#E7E5DB] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-black resize-none" />
            <button type="submit" className="bg-[#14181D] text-white text-xs font-bold px-4 py-2 rounded-xl">Launch Thread</button>
          </form>
        )}

        <div className="space-y-4">
          {loading ? (
            <p className="text-center py-6 text-xs text-[#5B5F66] font-mono animate-pulse">Syncing cache database...</p>
          ) : currentPosts.map((post) => (
            <div key={post.id} className="bg-white border border-[#E7E5DB] rounded-2xl p-5 space-y-3">
              <div className="flex justify-between text-[10px] text-[#9A9EA4] font-mono">
                <span>{post.user_email}</span>
                <span>{new Date(post.created_at).toLocaleDateString()}</span>
              </div>
              <h3 className="text-base font-bold text-black tracking-tight">{post.title}</h3>
              <p className="text-xs text-[#5B5F66] leading-relaxed whitespace-pre-wrap">{post.content}</p>

              {post.replies.length > 0 && (
                <div className="bg-[#FAF9F5] rounded-xl p-3 space-y-2 border border-[#E7E5DB]/50">
                  {post.replies.map((r) => (
                    <div key={r.id} className="text-xs border-b border-[#E7E5DB]/30 last:border-0 pb-1.5 last:pb-0">
                      <p className="text-[10px] text-[#9A9EA4] font-mono">{r.user_email}</p>
                      <p className="text-[#14181D] font-light">{r.content}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-[#FAF9F5]">
                {user ? (
                  <div>
                    {activeReplyId === post.id ? (
                      <form onSubmit={(e) => handleCreateReply(e, post.id)} className="flex gap-2">
                        <input type="text" autoFocus placeholder="Write reply..." value={replyContent} onChange={(e) => setReplyContent(e.target.value)} className="flex-1 h-8 bg-[#FAF9F5] border border-[#E7E5DB] rounded-lg px-3 text-xs focus:outline-none" />
                        <button type="submit" className="bg-black text-white text-[10px] px-3 rounded-lg">Send</button>
                        <button type="button" onClick={() => setActiveReplyId(null)} className="text-xs text-[#5B5F66]">Cancel</button>
                      </form>
                    ) : (
                      <button onClick={() => setActiveReplyId(post.id)} className="text-xs font-semibold text-[#0070F3] font-mono">↳ Reply</button>
                    )}
                  </div>
                ) : <span className="text-[11px] text-[#9A9EA4] italic font-light">Sign in to interact</span>}

                <button onClick={() => handleShare(post)} className="text-xs font-mono text-[#5B5F66] hover:text-black transition-colors flex items-center space-x-1">
                  <span>{sharedPostId === post.id ? "✓ Link Copied" : "⚲ Share"}</span>
                </button>
              </div>
            </div>
          ))}

          {/* Sistemul Vizual de Paginare */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 font-mono text-xs text-[#5B5F66]">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="bg-white border border-[#E7E5DB] px-3 py-1.5 rounded-lg disabled:opacity-30 hover:text-black transition-colors"
              >
                ← Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="bg-white border border-[#E7E5DB] px-3 py-1.5 rounded-lg disabled:opacity-30 hover:text-black transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
