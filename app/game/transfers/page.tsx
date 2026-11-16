"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { formatMoney } from "@/lib/football/finance";
import { TransferModals } from "@/components/TransferModals";
import Icon from "@/components/Icon";

export default function TransferPage() {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListing, setSelectedListing] = useState<any>(null);

  useEffect(() => {
    async function fetchListings() {
      setLoading(true);
      // جلب البيانات الأساسية من الجدول
      const { data, error } = await supabase
        .from("transfer_listings")
        .select("*")
        .eq("status", "open");
      
      if (error) {
        console.error("خطأ في جلب بيانات الانتقالات:", error);
      } else {
        console.log("البيانات التي تم جلبها:", data);
        setListings(data || []);
      }
      setLoading(false);
    }
    fetchListings();
  }, []);

  if (loading) return <div style={{padding: '20px', color: '#fff'}}>جاري تحميل سوق الانتقالات...</div>;

  return (
    <div className="tr-container">
      <header className="tr-header">
        <h1>سوق الانتقالات</h1>
      </header>

      {listings.length === 0 ? (
        <p style={{padding: '20px', color: '#888'}}>لا يوجد لاعبون معروضون للبيع حالياً.</p>
      ) : (
        <table className="tr-table">
          <thead>
            <tr>
              <th>اللاعب (ID)</th>
              <th>السعر المطلوب</th>
              <th>شراء فوري</th>
              <th>الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((item) => (
              <tr key={item.id}>
                <td>{item.player_id}</td>
                <td>{formatMoney(item.asking)}</td>
                <td className="is-gold">{item.buy_now_price ? formatMoney(item.buy_now_price) : "-"}</td>
                <td>
                  <button className="gx-btn-small" onClick={() => setSelectedListing(item)}>
                    تفاصيل
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedListing && (
        <TransferModals 
          listing={selectedListing}
          onClose={() => setSelectedListing(null)}
          onDone={() => window.location.reload()}
        />
      )}
    </div>
  );
}