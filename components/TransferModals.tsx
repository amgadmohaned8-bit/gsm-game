"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatMoney } from "@/lib/football/finance";
import Icon from "@/components/Icon";

// تصديرات لضمان عدم حدوث خطأ أثناء البناء
export const fm = formatMoney;
export const money = formatMoney;

export function BidModal(props: any) {
  return <TransferModals {...props} />;
}

export function TransferModals({ listing, onClose, onDone }: any) {
  const [phase, setPhase] = useState<"options" | "offer">("options");
  const [busy, setBusy] = useState(false);

  async function handleBuyNow() {
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.rpc("buy_player_now", {
      p_listing_id: listing.id,
      p_buyer_id: user?.id,
      p_buyer_club: "my-club",
      p_season: "2025/2026",
      p_matchday: 1
    });

    setBusy(false);
    if (error) alert("خطأ: " + error.message);
    else { alert("تمت الصفقة!"); onDone(); }
  }

  return (
    <div className="tb bk-modal" role="presentation" onClick={onClose}>
      <div className="tb-panel" role="dialog" onClick={(e) => e.stopPropagation()}>
        <button className="tb-close" onClick={onClose}><Icon name="close" size={20} /></button>
        <h3>إدارة الصفقة</h3>
        {phase === "options" && (
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
            <p>السعر: {formatMoney(listing.asking)}</p>
            {listing.buy_now_price && (
              <button className="gx-btn" style={{background: '#d4af37'}} onClick={handleBuyNow} disabled={busy}>
                شراء فوري ({formatMoney(listing.buy_now_price)})
              </button>
            )}
            <button className="gx-btn" onClick={() => setPhase("offer")}>تقديم عرض</button>
          </div>
        )}
      </div>
    </div>
  );
}