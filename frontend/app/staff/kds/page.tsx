'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Utensils, Clock, CheckCircle2, AlertCircle,
  RefreshCw, ChefHat, MapPin, ArrowRight
} from 'lucide-react';
import { getKdsOrders, updateKdsOrderStatus } from '@/services/api';

export default function KitchenDisplaySystemPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'ALL' | 'PREPARING' | 'READY' | 'DELIVERED'>('ALL');

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000); // Polling every 10s for new kitchen orders
    return () => clearInterval(interval);
  }, []);

  async function fetchOrders() {
    try {
      const res = await getKdsOrders();
      setOrders(res.orders || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(orderId: number, nextStatus: string) {
    try {
      await updateKdsOrderStatus(orderId, nextStatus);
      fetchOrders();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  }

  const filteredOrders = orders.filter((o) => {
    if (filter === 'ALL') return true;
    return o.delivery_status === filter;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 w-full text-white space-y-8">
      {/* KDS Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-red-600/20 px-3 py-1 text-xs font-bold text-red-400 mb-2 border border-red-500/30">
            <ChefHat className="h-3.5 w-3.5" />
            <span>KITCHEN OPERATIONS (KDS)</span>
          </div>
          <h1 className="text-3xl font-black text-white">Kitchen Display & Concessions Dispatch</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Zero-PII food dispatch terminal: target row, seat number, order items, and delivery lifecycle
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchOrders}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/10 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 px-4 py-2 text-xs font-bold text-white transition"
          >
            <span>Exit KDS</span>
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-3">
        {(['ALL', 'PREPARING', 'READY', 'DELIVERED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              filter === tab
                ? 'bg-red-600 text-white'
                : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Orders Grid */}
      {loading ? (
        <div className="p-12 text-center text-zinc-400">Loading active kitchen tickets...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#12131a] p-12 text-center text-zinc-500 space-y-2">
          <Utensils className="h-8 w-8 mx-auto text-zinc-600" />
          <p>No active concession orders under filter {filter}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrders.map((order) => (
            <div
              key={order.order_id}
              className="rounded-2xl border border-white/10 bg-[#161822] p-5 space-y-4 shadow-xl flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <span className="text-[10px] text-zinc-500 block">ORDER ID</span>
                    <span className="font-mono text-sm font-bold text-white">#{order.order_id}</span>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      order.delivery_status === 'PREPARING'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : order.delivery_status === 'READY'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {order.delivery_status}
                  </span>
                </div>

                {/* Delivery Location - Zero PII */}
                <div className="rounded-xl bg-black/40 p-3 border border-white/5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-red-500 shrink-0" />
                    <div>
                      <span className="text-[10px] text-zinc-500 block">DELIVERY DESTINATION</span>
                      <span className="font-bold text-white">
                        {order.delivery_type === 'SEAT_DELIVERY'
                          ? `Row ${order.target_row || '-'}, Seat ${order.target_seat}`
                          : 'Counter Pickup'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-1.5 text-xs">
                  <span className="text-[10px] text-zinc-500 block uppercase font-semibold">Ordered Items</span>
                  <div className="rounded-xl bg-white/5 p-3 space-y-1 border border-white/5">
                    {order.items?.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between font-mono">
                        <span className="text-zinc-200">
                          {item.quantity}x {item.name}
                        </span>
                        <span className="text-zinc-400">₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Status Action Buttons */}
              <div className="pt-2 border-t border-white/10 flex gap-2">
                {order.delivery_status === 'PREPARING' && (
                  <button
                    onClick={() => handleStatusChange(order.order_id, 'READY')}
                    className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 px-3 py-2 text-xs font-bold text-white transition text-center"
                  >
                    Mark as READY
                  </button>
                )}

                {order.delivery_status === 'READY' && (
                  <button
                    onClick={() => handleStatusChange(order.order_id, 'DELIVERED')}
                    className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-xs font-bold text-white transition text-center"
                  >
                    Mark as DELIVERED
                  </button>
                )}

                {order.delivery_status === 'DELIVERED' && (
                  <div className="flex-1 py-1.5 text-center text-xs font-semibold text-emerald-400 flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Completed</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
