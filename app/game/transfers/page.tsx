"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { formatMoney } from "@/lib/football/finance";
import { TransferModals } from "@/components/TransferModals";
import Icon from "@/components/Icon";

// تعريف دالة fm لتتناسب مع مشروعك
export const fm = formatMoney;

export default function TransferPage() {
  const [listings, setListings] = useState<any[]>([]);
  const [selectedListing, setSelectedListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // جلب البيانات من Supabase
  useEffect(() => {
    async function fetchListings() {
      const { data, error } = await supabase
        .from("transfer_listings")
        .select(`
          *,
          players(name),
          clubs(name)
        `)
        .eq("status", "open");
      
      if (!error && data) setListings(data);
      setLoading(false);
    }
    fetchListings();
  }, []);

  if (loading) return <div>جاري تحميل السوق...</div>;

  return (
    <div className="tr-container">
      <header className="tr-header">
        <h1>سوق الانتقالات</h1>
      </header>

      <table className="tr-table">
        <thead>
          <tr>
            <th>اللاعب</th>
            <th>النادي</th>
            <th>السعر المطلوب</th>
            <th>شراء فوري</th>
            <th>الإجراء</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((item) => (
            <tr key={item.id}>
              <td>{item.players?.name || "لاعب مجهول"}</td>
              <td>{item.clubs?.name || "نادي مجهول"}</td>
              <td>{fm(item.asking)}</td>
              <td className="is-gold">{item.buy_now_price ? fm(item.buy_now_price) : "-"}</td>
              <td>
                <button 
                  className="gx-btn-small" 
                  onClick={() => setSelectedListing(item)}
                >
                  تفاصيل
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* المودال للتحكم في عمليات الشراء */}
      {selectedListing && (
        <TransferModals 
          listing={selectedListing}
          onClose={() => setSelectedListing(null)}
          onDone={() => {
            setSelectedListing(null);
            // إعادة تحميل البيانات بعد الشراء
            window.location.reload(); 
          }}
        />
      )}
    </div>
  );
}