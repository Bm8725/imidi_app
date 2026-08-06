/**
 * 
 * app/forum/ForumClient.tsx
 */



"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase";

interface Reply { id: string; post_id: string; user_email: string; content: string; created_at: string; }
interface Post { id: string; title: string; content: string; user_email: string; created_at: string; replies: Reply[]; }

export default function ForumClient() {
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState({ title: "", content: "" });
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [sharedPostId, setSharedPostId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user || null));
    (async () => {
      const { data: p } = await supabase.from("forum_posts").select("*").order("created_at", { ascending: false });
      const { data: r } = await supabase.from("forum_replies").select("*").order("created_at", { ascending: true });
      setPosts((p || []).map((post: any) => ({ ...post, replies: (r || []).filter((rep: any) => rep.post_id === post.id) })));
      setLoading(false);
    })();
  }, []);

  const currentPosts = posts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(posts.length / itemsPerPage);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.title || !newPost.content) return;
    const { data, error } = await supabase.from("forum_posts").insert([{ ...newPost, user_id: user.id, user_email: user.email }]).select().single();
    if (data && !error) { setPosts([{ ...data, replies: [] }, ...posts]); setNewPost({ title: "", content: "" }); setCurrentPage(1); }
  };

  const handleCreateReply = async (e: React.FormEvent, postId: string) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    const { data, error } = await supabase.from("forum_replies").insert([{ post_id: postId, content: replyContent, user_id: user.id, user_email: user.email }]).select().single();
    if (data && !error) { setPosts(posts.map((p) => p.id === postId ? { ...p, replies: [...p.replies, data as Reply] } : p)); setReplyContent(""); setActiveReplyId(null); }
  };

  const handleShare = async (post: Post) => {
    const shareUrl = `${window.location.origin}/forum?post=${post.id}`;
    if (navigator.share) { try { await navigator.share({ title: post.title, url: shareUrl }); } catch {} } 
    else { navigator.clipboard.writeText(shareUrl); setSharedPostId(post.id); setTimeout(() => setSharedPostId(null), 2000); }
  };

  return (
    <div className="bg-black text-white min-h-screen flex flex-col antialiased selection:bg-white/20">
      <Navbar />
      <main className="font-sans flex-1 w-full max-w-3xl mx-auto px-4 pt-36 pb-24 space-y-8">
        <div className="border-b border-white/[0.08] pb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-white">Forum community iMIDI</h1>
          <p className="text-sm text-[#8E8E93] mt-2">Discuss MIDI routing, hardware patches, and system logs.</p>
        </div>

        {!user ? (
          <div className="border border-white/[0.08] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm hover:border-white/20 transition-colors">
            <p className="text-[#8E8E93]">You are browsing in read-only mode. Authenticate to deploy threads.</p>
            <Link href="/login" className="bg-white text-black px-4 h-9 rounded-lg font-medium text-xs flex items-center justify-center hover:bg-[#E5E5EA] transition-colors shrink-0">Sign In →</Link>
          </div>
        ) : (
          <form onSubmit={handleCreatePost} className="bg-[#141416] border border-white/[0.08] rounded-xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2 text-xs text-[#8E8E93]"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><p>Posting as: <span className="font-medium text-white font-mono">{user.email}</span></p></div>
            <input type="text" placeholder="Thread Title..." value={newPost.title} onChange={(e) => setNewPost({ ...newPost, title: e.target.value })} className="w-full h-10 bg-transparent border border-white/[0.08] rounded-lg px-3 text-sm text-white placeholder-[#48484A] focus:outline-none focus:border-white/30 transition-colors" />
            <textarea placeholder="Elaborate your question..." rows={3} value={newPost.content} onChange={(e) => setNewPost({ ...newPost, content: e.target.value })} className="w-full bg-transparent border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#48484A] focus:outline-none focus:border-white/30 transition-colors resize-none" />
            <div className="flex justify-end"><button type="submit" className="bg-white text-black text-xs font-semibold px-4 h-9 rounded-lg hover:bg-[#E5E5EA] transition-colors">Launch Thread</button></div>
          </form>
        )}

        <div className="space-y-6">
          {loading ? <p className="text-center py-12 text-xs text-[#8E8E93] font-mono animate-pulse">Syncing core threads...</p> : currentPosts.map((post) => (
            <div key={post.id} className="border-t border-white/[0.12] pt-6 group">
              <div className="flex justify-between items-center text-[11px] text-[#636366] font-mono"><span>{post.user_email}</span><span>{new Date(post.created_at).toLocaleDateString()}</span></div>
              <h3 className="text-lg font-medium text-white mt-3 group-hover:text-[#FF5CA1] transition-colors duration-300">{post.title}</h3>
              <p className="text-sm text-[#8E8E93] mt-1.5 leading-relaxed whitespace-pre-wrap">{post.content}</p>

              {post.replies.length > 0 && (
                <div className="mt-4 bg-[#141416]/50 border border-white/[0.04] rounded-xl p-4 space-y-3">
                  {post.replies.map((r) => (
                    <div key={r.id} className="text-xs border-b border-white/[0.04] last:border-0 pb-3 last:pb-0 space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-[#636366] font-mono"><span className="text-[#8E8E93]">{r.user_email}</span><span>{new Date(r.created_at).toLocaleDateString()}</span></div>
                      <p className="text-[#E5E5EA] leading-relaxed">{r.content}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-4 mt-2">
                {user ? (
                  <div className="w-full">
                    {activeReplyId === post.id ? (
                      <form onSubmit={(e) => handleCreateReply(e, post.id)} className="flex items-center gap-2 w-full">
                        <input type="text" autoFocus placeholder="Write technical reply..." value={replyContent} onChange={(e) => setReplyContent(e.target.value)} className="flex-1 h-9 bg-[#141416] border border-white/[0.08] rounded-lg px-3 text-xs text-white focus:outline-none focus:border-white/30" />
                        <button type="submit" className="bg-white text-black text-[11px] font-semibold h-9 px-4 rounded-lg hover:bg-[#E5E5EA]">Send</button>
                        <button type="button" onClick={() => setActiveReplyId(null)} className="text-xs text-[#8E8E93] px-2 hover:text-white">Cancel</button>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <button onClick={() => setActiveReplyId(post.id)} className="text-xs font-semibold text-white/80 hover:text-white transition-colors">↳ Reply</button>
                        <button onClick={() => handleShare(post)} className="text-xs font-semibold text-[#8E8E93] hover:text-white transition-colors">{sharedPostId === post.id ? "✓ Copied" : "Share"}</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between w-full text-xs text-[#636366]"><span>Read-only thread</span><button onClick={() => handleShare(post)} className="text-[#8E8E93] hover:text-white transition-colors font-medium">{sharedPostId === post.id ? "✓ Link Copied" : "Share"}</button></div>
                )}
              </div>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-6 border-t border-white/[0.08] text-xs">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} className="h-8 px-3 border border-white/[0.08] rounded-lg text-white disabled:opacity-40 hover:bg-white/[0.04] transition-all">← Previous</button>
            <span className="text-[#636366] font-mono">Page {currentPage} of {totalPages}</span>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} className="h-8 px-3 border border-white/[0.08] rounded-lg text-white disabled:opacity-40 hover:bg-white/[0.04] transition-all">Next →</button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}