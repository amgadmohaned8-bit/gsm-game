"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatMoney } from "@/lib/football/finance";
import Icon from "@/components/Icon";
import "./transfers.css";

export const fm = formatMoney;

export function TransferModals({
  listing,
  onClose,
  onDone,
}: {
  listing: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"options" | "buy" | "offer">("options");
  const [offerAmount, setOfferAmount] = useState<number>(listing.asking || 10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // دالة الشراء الفوري
  async function handleBuyNow() {
    setBusy(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("يجب تسجيل الدخول أولاً");

      // استدعاء دالة Supabase التي أنشأناها في الـ SQL
      const { error: rpcError } = await supabase.rpc("buy_player_now", {
        p_listing_id: listing.id,
        p_buyer_id: user.id,
        p_buyer_club: "my-club-id", // سيتم ربطه بناديك الحالي
        p_season: listing.season || "2025/2026",
        p_matchday: listing.listed_matchday || 1
      });

      if (rpcError) throw rpcError;

      alert("تمت صفقة الشراء بنجاح!");
      onDone();
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء تنفيذ الصفقة");
    } finally {
      setBusy(false);
    }
  }

  // دالة إرسال عرض تفاوضي
  async function handleMakeOffer() {
    setBusy(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("يجب تسجيل الدخول أولاً");

      const { error: insertError } = await supabase.from("manager_offers").insert({
        room_id: listing.room_id || "00000000-0000-0000-0000-000000000000",
        buyer_id: user.id,
        buyer_club: "my-club-id",
        seller_id: listing.user_id,
        seller_club: listing.club_id || "seller-club",
        player_id: listing.player_id,
        amount: offerAmount,
        season: listing.season || "2025/2026",
        status: "open"
      });

      if (insertError) throw insertError;

      alert("تم إرسال العرض بنجاح إلى النادي البائع!");
      onDone();
    } catch (err: any) {
      setError(err.message || "فشل إرسال العرض");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tb bk-modal" role="presentation" onClick={onClose}>
      <div className="tb-panel gx-cut" role="dialog" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="tb-close" onClick={onClose} aria-label="Close">
          <Icon name="close" size={20} />
        </button>
        
        <header className="bk-mh">
          <h2>إدارة صفقة اللاعب</h2>
        </header>

        <div className="tb-stage" style={{ padding: "20px" }}>
          <div style={{ marginBottom: "20px", textAlign: "center" }}>
            <h3 style={{ fontSize: "1.2rem", color: "#fff", marginBottom: "8px" }}>
              {listing.players?.name || "اللاعب"}
            </h3>
            <p style={{ color: "#aaa", fontSize: "0.9rem" }}>
              السعر المطلوب: <strong style={{ color: "#fff" }}>{fm(listing.asking)}</strong>
            </p>
            {listing.buy_now_price && (
              <p style={{ color: "#d4af37", fontSize: "0.95rem", marginTop: "4px" }}>
                سعر الشراء الفوري: <strong>{fm(listing.buy_now_price)}</strong>
              </p>
            )}
          </div>

          {phase === "options" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {listing.buy_now_price && (
                <button 
                  type="button" 
                  className="gx-btn" 
                  style={{ background: "linear-gradient(135deg, #d4af37, #aa8c2a)", color: "#000", fontWeight: "bold" }}
                  disabled={busy}
                  onClick={handleBuyNow}
                >
                  {busy ? "جاري الشراء..." : `شراء الآن (${fm(listing.buy_now_price)})`}
                </button>
              )}
              <button 
                type="button" 
                className="gx-btn" 
                onClick={() => setPhase("offer")}
                disabled={busy}
              >
                تقديم عرض تفاوضي
              </button>
            </div>
          )}

          {phase === "offer" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <label className="tb-label" style={{ color: "#ccc" }}>قيمة العرض (بالمليون):</label>
              <input 
                type="number" 
                value={offerAmount} 
                onChange={(e) => setOfferAmount(Number(e.target.value))}
                style={{ 
                  padding: "10px", 
                  width: "100%", 
                  background: "#111", 
                  color: "#fff", 
                  border: "1px solid #d4af37",
                  borderRadius: "4px"
                }} 
              />
              <button 
                type="button" 
                className="gx-btn" 
                disabled={busy}
                onClick={handleMakeOffer}
              >
                {busy ? "جاري الإرسال..." : "تأكيد وإرسال العرض"}
              </button>
              <button 
                type="button" 
                className="tb-ghost" 
                style={{ background: "transparent", border: "1px solid #444", color: "#aaa", padding: "8px", cursor: "pointer" }}
                onClick={() => setPhase("options")}
              >
                رجوع
              </button>
            </div>
          )}

          {error && (
            <p role="alert" style={{ color: "#ff4d4d", marginTop: "12px", textAlign: "center", fontSize: "0.85rem" }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}