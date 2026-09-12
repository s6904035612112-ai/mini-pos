"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function SellPage() {
  // รายการสินค้าทั้งหมด (สำหรับ dropdown)
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // ค่าที่เลือก/กรอกในฟอร์มขายสินค้า
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");

  // สถานะข้อความแจ้งเตือน/ยืนยัน
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // โหลดรายการสินค้าตอนเปิดหน้า
  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      setErrorMsg(error.message);
    } else {
      setProducts(data);
    }
    setLoading(false);
  }

  // หาข้อมูลสินค้าที่กำลังเลือกอยู่ (เพื่อดึงราคา/stock มาใช้คำนวณ)
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // คำนวณยอดรวม = ราคา x จำนวน
  const qtyNumber = parseInt(quantity, 10) || 0;
  const totalPrice = selectedProduct ? selectedProduct.price * qtyNumber : 0;

  function handleProductChange(e) {
    setSelectedProductId(e.target.value);
    setErrorMsg("");
    setSuccessMsg("");
  }

  function handleQuantityChange(e) {
    setQuantity(e.target.value);
    setErrorMsg("");
    setSuccessMsg("");
  }

  // เมื่อกดปุ่ม "ขาย"
  async function handleSell(e) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!selectedProduct) {
      setErrorMsg("กรุณาเลือกสินค้า");
      return;
    }
    if (qtyNumber <= 0) {
      setErrorMsg("กรุณากรอกจำนวนที่ต้องการขายให้ถูกต้อง");
      return;
    }
    // ตรวจสอบว่า stock เพียงพอหรือไม่
    if (qtyNumber > selectedProduct.stock) {
      setErrorMsg(
        `สินค้าคงเหลือไม่พอ (คงเหลือ ${selectedProduct.stock} ${selectedProduct.unit})`
      );
      return;
    }

    setSubmitting(true);

    // 1) บันทึกรายการขายลงตาราง sales
    const { error: saleError } = await supabase.from("sales").insert([
      {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        quantity: qtyNumber,
        total_price: totalPrice,
        sold_at: new Date().toISOString(),
      },
    ]);

    if (saleError) {
      setErrorMsg(saleError.message);
      setSubmitting(false);
      return;
    }

    // 2) อัปเดต stock ของสินค้าให้ลดลงตามจำนวนที่ขาย
    const newStock = selectedProduct.stock - qtyNumber;
    const { error: updateError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", selectedProduct.id);

    if (updateError) {
      setErrorMsg(updateError.message);
      setSubmitting(false);
      return;
    }

    // สำเร็จ: แสดงข้อความยืนยันและรีเซ็ตฟอร์ม
    setSuccessMsg(
      `ขาย ${selectedProduct.name} จำนวน ${qtyNumber} ${selectedProduct.unit} สำเร็จ (รวม ${totalPrice.toFixed(
        2
      )} บาท)`
    );
    setSelectedProductId("");
    setQuantity("");
    setSubmitting(false);

    // โหลดรายการสินค้าใหม่เพื่ออัปเดตจำนวนคงเหลือที่แสดงอยู่
    fetchProducts();
  }

  return (
    <div>
      <h1>ขายสินค้า</h1>

      {errorMsg && (
        <p style={{ color: "red", fontWeight: "bold" }}>{errorMsg}</p>
      )}
      {successMsg && (
        <p style={{ color: "green", fontWeight: "bold" }}>{successMsg}</p>
      )}

      {loading ? (
        <p>กำลังโหลดข้อมูลสินค้า...</p>
      ) : (
        <div className="card">
          <form onSubmit={handleSell}>
            <div className="form-row">
              {/* Dropdown เลือกสินค้า แสดงชื่อและราคา */}
              <select value={selectedProductId} onChange={handleProductChange}>
                <option value="">-- เลือกสินค้า --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} - {p.price} บาท (คงเหลือ {p.stock} {p.unit})
                  </option>
                ))}
              </select>

              {/* ช่องกรอกจำนวน */}
              <input
                type="number"
                min="1"
                placeholder="จำนวน"
                value={quantity}
                onChange={handleQuantityChange}
              />
            </div>

            {/* แสดงยอดรวมอัตโนมัติ */}
            <p style={{ fontSize: "18px", fontWeight: "bold" }}>
              ยอดรวม: {totalPrice.toFixed(2)} บาท
            </p>

            <button type="submit" disabled={submitting}>
              {submitting ? "กำลังบันทึก..." : "ขาย"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
