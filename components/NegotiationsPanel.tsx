"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatMoney } from "@/lib/football/finance";
import Icon from "@/components/Icon";

export const fm = formatMoney;

export function NegotiationsPanel({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadOffers() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data, error } = await supabase
        .from("manager_offers")
        .select("*")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .in("status", ["open", "countered"]);

      if (!error && data) setOffers(data);
      setLoading(false);
    }
    loadOffers();
  }, []);

  async function handleAccept(offerId: string) {
    const { error } = await supabase.rpc("accept_manager_offer", {
      p_offer: offerId,
      p_season: "2025/2026",
      p_matchday: 1
    });

    if (error) alert("فشل قبول الصفقة: " + error.message);
    else {
      alert("تم قبول الصفقة ونقل اللاعب بنجاح!");
      onDone();
    }
  }

  async function handleReject(offerId: string) {
    const { error } = await supabase
      .from("manager_offers")
      .update({ status: "rejected", updated_at: new Date() })
      .eq("id", offerId);

    if (error) alert("فشل رفض العرض");
    else {
      setOffers(offers.filter(o => o.id !== offerId));
    }
  }

  if (loading) return <div>جاري تحميل المفاوضات...</div>;

  return (
    <div className="tb bk-modal" role="presentation" onClick={onClose}>
      <div className="tb-panel gx-cut" role="dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
        <button type="button" className="tb-close" onClick={onClose} aria-label="Close">
          <Icon name="close" size={20} />
        </button>

        <header className="bk-mh">
          <h2>المفاوضات والعروض الجارية</h2>
        </header>

        <div className="tb-stage" style={{ padding: "20px", maxHeight: "400px", overflowY: "auto" }}>
          {offers.length === 0 ? (
            <p style={{ textAlign: "center", color: "#888" }}>لا توجد مفاوضات أو عروض نشطة حالياً.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {offers.map((offer) => {
                const isSeller = offer.seller_id === userId;
                return (
                  <div key={offer.id} style={{ background: "#111", border: "1px solid #333", padding: "15px", borderRadius: "6px" }}>
                    <p style={{ color: "#fff", marginBottom: "6px" }}>
                      <strong>{isSeller ? "عرض وارد من مدرب آخر" : "عرض مرسل من قبلك"}</strong>
                    </p>
                    <p style={{ color: "#d4af37", fontSize: "1.1rem", marginBottom: "10px" }}>
                      المبلغ: {fm(offer.amount)} {offer.counter ? `(عرض مضاد: ${fm(offer.counter)})` : ""}
                    </p>
                    <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: "15px" }}>
                      الحالة: {offer.status}
                    </p>

                    {isSeller && offer.status === "open" && (
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button 
                          className="gx-btn" 
                          style={{ background: "#2ecc71", color: "#000", flex: 1 }}
                          onClick={() => handleAccept(offer.id)}
                        >
                          قبول
                        </button>
                        <button 
                          className="gx-btn" 
                          style={{ background: "#e74c3c", color: "#fff", flex: 1 }}
                          onClick={() => handleReject(offer.id)}
                        >
                          رفض
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}