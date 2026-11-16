"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatMoney } from "@/lib/football/finance";
import Icon from "@/components/Icon";
import "./transfers.css";

// التصديرات المطلوبة لتجنب خطأ الـ Build
export const fm = formatMoney;
export const money = formatMoney;

export function BidModal(props: any) {
  return <TransferModals {...props} />;
}

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

  async function handleBuyNow() {
    setBusy(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("يجب تسجيل الدخول أولاً");

      const { error: rpcError } = await supabase.rpc("buy_player_now", {
        p_listing_id: listing.id,
        p_buyer_id: user.id,
        p_buyer_club: "my-club-id",
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
      alert("تم إرسال العرض بنجاح!");
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
        <button type="button" className="tb-close" onClick={onClose}><Icon name="close" size={20} /></button>
        <header className="bk-mh"><h2>إدارة الصفقة</h2></header>
        <div className="tb-stage" style={{ padding: "20px" }}>
          {phase === "options" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <p>اللاعب: {listing.players?.name}</p>
              <p>السعر المطلوب: {formatMoney(listing.asking)}</p>
              {listing.buy_now_price && (
                <button className="gx-btn" style={{ background: "#d4af37", color: "#000" }} onClick={handleBuyNow} disabled={busy}>
                  شراء الآن ({formatMoney(listing.buy_now_price)})
                </button>
              )}
              <button className="gx-btn" onClick={() => setPhase("offer")}>تقديم عرض</button>
            </div>
          )}
          {phase === "offer" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input type="number" value={offerAmount} onChange={(e) => setOfferAmount(Number(e.target.value))} />
              <button className="gx-btn" onClick={handleMakeOffer} disabled={busy}>تأكيد العرض</button>
              <button className="tb-ghost" onClick={() => setPhase("options")}>رجوع</button>
            </div>
          )}
          {error && <p style={{ color: "red" }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}