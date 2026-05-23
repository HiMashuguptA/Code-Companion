import { useState } from "react";
import { CheckCircle, XCircle, Phone, Mail, Package, RotateCcw, MessageSquare, Truck, RefreshCw, DollarSign, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListOrders, useListUsers, getListOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDateTime, formatPrice, getOrderStatusColor, getOrderStatusLabel } from "@/lib/utils";

type ReturnOrder = {
  id: string;
  status: string;
  notes?: string | null;
  returnImages?: string[] | null;
  total: number;
  createdAt: string;
  items: Array<{ productName?: string; quantity: number; price: number }>;
  user?: { name?: string | null; email: string; phone?: string | null } | null;
  deliveryAddress?: { street?: string; city?: string; state?: string; lat?: number; lng?: number } | null;
  deliveryAgentId?: string | null;
};

const RETURN_STATUSES = ["RETURN_PENDING", "RETURN_IN_TRANSIT", "RETURNED", "REFUND_INITIATED"];

function parseReturnData(order: ReturnOrder) {
  const notes = order.notes ?? "";
  const prefix = notes.startsWith("RETURN_REQUESTED:") ? "RETURN_REQUESTED"
    : notes.startsWith("RETURN_APPROVED:") ? "RETURN_APPROVED"
    : notes.startsWith("RETURN_REJECTED:") ? "RETURN_REJECTED"
    : null;
  const reason = prefix ? notes.slice(prefix.length + 1).split(" | ")[0].trim() : "";
  return { prefix, reason };
}

function isReturnOrder(o: ReturnOrder) {
  const notes = o.notes ?? "";
  return RETURN_STATUSES.includes(o.status)
    || (o.status === "CANCELLED" && (notes.startsWith("RETURN_REQUESTED:") || notes.startsWith("RETURN_APPROVED:")))
    || (o.status === "DELIVERED" && notes.startsWith("RETURN_REJECTED:"));
}

export function AdminReturns() {
  const qc = useQueryClient();
  const { currentUser } = useAuth();
  const [selectedOrder, setSelectedOrder] = useState<ReturnOrder | null>(null);
  const [rejectMsg, setRejectMsg] = useState("");
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const { data, isLoading } = useListOrders({ limit: 200 }, {
    query: {
      queryKey: getListOrdersQueryKey({ limit: 200 }),
      enabled: !!currentUser,
      refetchInterval: 10000,
    },
  });

  const { data: usersResponse } = useListUsers({}, {
    query: { queryKey: ["admin-users-list"], staleTime: 1000 * 60 * 5 },
  });
  const deliveryAgents = (
    Array.isArray(usersResponse)
      ? usersResponse
      : (usersResponse?.users ?? [])
  ).filter((u: { role: string }) => u.role === "DELIVERY_AGENT") as Array<{ id: string; name?: string | null; email: string }>;

  const allOrders = (data?.orders ?? []) as ReturnOrder[];
  const returnOrders = allOrders.filter(isReturnOrder);

  const callApi = async (path: string, body?: object) => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error((d as { error?: string }).error ?? "Failed");
    }
    return res.json();
  };

  const doAction = async (orderId: string, action: string, body?: object, successMsg?: string) => {
    setActionPending(orderId + action);
    try {
      await callApi(`/api/orders/${orderId}/${action}`, body);
      toast.success(successMsg ?? "Done");
      setSelectedOrder(null);
      setRejectMsg("");
      setSelectedAgentId("");
      qc.invalidateQueries({ queryKey: getListOrdersQueryKey({ limit: 200 }) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setActionPending(null);
    }
  };

  const statusBadge = (order: ReturnOrder) => {
    const notes = order.notes ?? "";
    if (order.status === "RETURN_PENDING") {
      if (notes.startsWith("RETURN_APPROVED:")) return <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/30 hover:bg-blue-500/10">Approved — Awaiting Pickup Agent</Badge>;
      return <Badge className="bg-orange-500/10 text-orange-700 border-orange-500/30 hover:bg-orange-500/10">Pending Review</Badge>;
    }
    if (order.status === "RETURN_IN_TRANSIT") return <Badge className="bg-sky-500/10 text-sky-700 border-sky-500/30 hover:bg-sky-500/10">In Transit — Agent Picking Up</Badge>;
    if (order.status === "RETURNED") return <Badge className="bg-teal-500/10 text-teal-700 border-teal-500/30 hover:bg-teal-500/10">Returned — Awaiting Refund</Badge>;
    if (order.status === "REFUND_INITIATED") return <Badge className="bg-violet-500/10 text-violet-700 border-violet-500/30 hover:bg-violet-500/10">Refund Initiated</Badge>;
    if (notes.startsWith("RETURN_REJECTED:")) return <Badge className="bg-red-500/10 text-red-700 border-red-500/30 hover:bg-red-500/10">Rejected</Badge>;
    if (notes.startsWith("RETURN_APPROVED:")) return <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/30 hover:bg-blue-500/10">Approved</Badge>;
    return <Badge className="bg-orange-500/10 text-orange-700 border-orange-500/30 hover:bg-orange-500/10">Pending</Badge>;
  };

  const pendingCount = returnOrders.filter(o => o.status === "RETURN_PENDING" && (o.notes ?? "").startsWith("RETURN_REQUESTED:")).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><RotateCcw className="w-6 h-6" /> Return Requests</h1>
          <p className="text-sm text-muted-foreground">Manage customer returns through the full return & refund workflow.</p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="outline" className="text-sm px-3 py-1 border-orange-400 text-orange-600">{pendingCount} awaiting review</Badge>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : returnOrders.length === 0 ? (
        <div className="text-center py-20 bg-card border rounded-xl">
          <RotateCcw className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">No return requests</p>
          <p className="text-sm text-muted-foreground">Customer return requests will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {returnOrders.map(order => {
            const { prefix, reason } = parseReturnData(order);
            const photos = order.returnImages ?? [];
            const isPending = order.status === "RETURN_PENDING" && (order.notes ?? "").startsWith("RETURN_REQUESTED:");
            return (
              <div key={order.id} className={`bg-card border rounded-xl p-4 ${isPending ? "border-orange-300" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-semibold text-sm">Order #{order.id.slice(-8).toUpperCase()}</span>
                      {statusBadge(order)}
                      <span className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</span>
                    </div>
                    {order.user && (
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-2">
                        <span className="flex items-center gap-1 font-medium text-foreground"><Package className="w-3 h-3" />{order.user.name ?? "—"}</span>
                        <a href={`mailto:${order.user.email}`} className="flex items-center gap-1 hover:text-primary"><Mail className="w-3 h-3" />{order.user.email}</a>
                        {order.user.phone && <a href={`tel:${order.user.phone}`} className="flex items-center gap-1 hover:text-primary"><Phone className="w-3 h-3" />{order.user.phone}</a>}
                      </div>
                    )}
                    {reason && (
                      <div className="flex items-start gap-1 text-xs text-muted-foreground mb-2">
                        <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                        <span className="italic">"{reason}"</span>
                        {photos.length > 0 && <span className="ml-1 text-blue-600 shrink-0">{photos.length} photo{photos.length > 1 ? "s" : ""}</span>}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {order.items?.slice(0, 2).map((item, i) => (
                        <span key={i}>{item.productName ?? "Product"} ×{item.quantity}{i < Math.min(order.items.length, 2) - 1 ? ", " : ""}</span>
                      ))}
                      {order.items?.length > 2 && <span> +{order.items.length - 2} more</span>}
                      <span className="ml-2 font-medium text-foreground">{formatPrice(order.total)}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setSelectedOrder(order); setRejectMsg(""); setSelectedAgentId(""); }}>
                    View Details
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={open => { if (!open) { setSelectedOrder(null); setRejectMsg(""); setSelectedAgentId(""); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Return — Order #{selectedOrder?.id.slice(-8).toUpperCase()}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (() => {
            const { prefix, reason } = parseReturnData(selectedOrder);
            const photos = selectedOrder.returnImages ?? [];
            const notes = selectedOrder.notes ?? "";
            const isApproveStep = selectedOrder.status === "RETURN_PENDING" && notes.startsWith("RETURN_REQUESTED:");
            const isAssignStep = selectedOrder.status === "RETURN_PENDING" && notes.startsWith("RETURN_APPROVED:");
            const isInTransit = selectedOrder.status === "RETURN_IN_TRANSIT";
            const isReturned = selectedOrder.status === "RETURNED";
            const isRefundDone = selectedOrder.status === "REFUND_INITIATED";
            const isLegacy = selectedOrder.status === "CANCELLED" && (notes.startsWith("RETURN_REQUESTED:") || notes.startsWith("RETURN_APPROVED:"));

            return (
              <div className="space-y-4 text-sm">
                {/* Status badge */}
                <div>{statusBadge(selectedOrder)}</div>

                {/* Return flow timeline */}
                <div className="flex items-center gap-1 text-xs">
                  {[
                    { label: "Requested", done: true },
                    { label: "Approved", done: !isApproveStep },
                    { label: "In Transit", done: isInTransit || isReturned || isRefundDone },
                    { label: "Returned", done: isReturned || isRefundDone },
                    { label: "Refunded", done: isRefundDone },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${step.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {step.done ? "✓" : i + 1}
                      </div>
                      <span className={step.done ? "text-primary font-medium" : "text-muted-foreground"}>{step.label}</span>
                      {i < 4 && <div className={`h-0.5 w-4 ${step.done ? "bg-primary" : "bg-muted"}`} />}
                    </div>
                  ))}
                </div>

                {/* Customer */}
                {selectedOrder.user && (
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                    <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-1">Customer</p>
                    <p className="font-medium">{selectedOrder.user.name ?? "—"}</p>
                    <a href={`mailto:${selectedOrder.user.email}`} className="flex items-center gap-1.5 text-blue-600 hover:underline">
                      <Mail className="w-3.5 h-3.5" />{selectedOrder.user.email}
                    </a>
                    {selectedOrder.user.phone && (
                      <a href={`tel:${selectedOrder.user.phone}`} className="flex items-center gap-1.5 text-blue-600 hover:underline">
                        <Phone className="w-3.5 h-3.5" />{selectedOrder.user.phone}
                      </a>
                    )}
                    {selectedOrder.deliveryAddress && (
                      <p className="text-muted-foreground text-xs mt-1">
                        📍 {[selectedOrder.deliveryAddress.street, selectedOrder.deliveryAddress.city, selectedOrder.deliveryAddress.state].filter(Boolean).join(", ")}
                        <span className="ml-1 text-blue-600">(Pickup address)</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Reason */}
                {reason && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-1">Return Reason</p>
                    <p className="italic">"{reason}"</p>
                  </div>
                )}

                {/* Customer photos */}
                {photos.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">Customer Photos ({photos.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {photos.map((img, i) => (
                        <button key={i} onClick={() => setLightboxImg(img)} className="group relative">
                          <img src={img} alt={`Return photo ${i + 1}`}
                            className="w-20 h-20 rounded-lg object-cover border-2 border-border hover:border-primary transition-colors cursor-pointer" />
                          <div className="absolute inset-0 rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-white" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Items */}
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">Items</p>
                  <div className="space-y-1">
                    {selectedOrder.items?.map((item, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{item.productName ?? "Product"} ×{item.quantity}</span>
                        <span className="text-muted-foreground">{formatPrice(item.price * item.quantity)}</span>
                      </div>
                    ))}
                    <div className="border-t pt-1 mt-1 flex justify-between font-semibold">
                      <span>Total</span><span>{formatPrice(selectedOrder.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {(isApproveStep || isLegacy) && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-1" disabled={!!actionPending}
                        onClick={() => doAction(selectedOrder.id, "return-approve", {}, "Return approved — now assign a pickup agent")}>
                        <CheckCircle className="w-4 h-4" />{actionPending ? "Approving…" : "Approve Return"}
                      </Button>
                      <Button variant="destructive" className="gap-1" disabled={!!actionPending}
                        onClick={() => setSelectedOrder({ ...selectedOrder, _rejectMode: true } as ReturnOrder & { _rejectMode: boolean })}>
                        <XCircle className="w-4 h-4" />Reject
                      </Button>
                    </div>
                  </div>
                )}

                {(selectedOrder as ReturnOrder & { _rejectMode?: boolean })._rejectMode && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground block">Rejection reason (sent to customer)</label>
                    <textarea className="w-full px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-destructive/40 resize-none" rows={3}
                      placeholder="Why is this return being rejected?" value={rejectMsg} onChange={e => setRejectMsg(e.target.value)} />
                    <div className="flex gap-2">
                      <Button variant="destructive" className="flex-1 gap-1" disabled={!!actionPending}
                        onClick={() => doAction(selectedOrder.id, "return-reject", { message: rejectMsg }, "Return rejected")}>
                        <XCircle className="w-4 h-4" />{actionPending ? "Rejecting…" : "Confirm Rejection"}
                      </Button>
                      <Button variant="outline" onClick={() => setSelectedOrder({ ...selectedOrder, _rejectMode: false } as ReturnOrder & { _rejectMode: boolean })}>Cancel</Button>
                    </div>
                  </div>
                )}

                {isAssignStep && (
                  <div className="space-y-3">
                    <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                      ✅ Return approved. Assign a delivery agent to collect the item from the customer.
                    </p>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Select Pickup Agent</label>
                      <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                        <SelectTrigger><SelectValue placeholder="Choose agent…" /></SelectTrigger>
                        <SelectContent>
                          {deliveryAgents.length === 0 ? (
                            <SelectItem value="__none" disabled>No agents available</SelectItem>
                          ) : deliveryAgents.map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.name ?? a.email}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full gap-1" disabled={!!actionPending || !selectedAgentId}
                      onClick={() => doAction(selectedOrder.id, "return-assign-agent", { agentId: selectedAgentId }, "Agent assigned for pickup — customer can now track in real time")}>
                      <Truck className="w-4 h-4" />{actionPending ? "Assigning…" : "Assign Pickup Agent"}
                    </Button>
                  </div>
                )}

                {isInTransit && (
                  <div className="space-y-3">
                    <p className="text-xs text-sky-600 bg-sky-50 rounded-lg px-3 py-2">
                      🚴 Agent is heading to the customer. Once item is physically collected, mark as returned.
                    </p>
                    <Button className="w-full gap-1 bg-teal-600 hover:bg-teal-700 text-white" disabled={!!actionPending}
                      onClick={() => doAction(selectedOrder.id, "return-mark-returned", {}, "Item marked as returned — customer notified")}>
                      <RefreshCw className="w-4 h-4" />{actionPending ? "Marking…" : "Mark Item Collected / Returned"}
                    </Button>
                  </div>
                )}

                {isReturned && (
                  <div className="space-y-3">
                    <p className="text-xs text-teal-600 bg-teal-50 rounded-lg px-3 py-2">
                      📦 Item received. Click below to initiate the refund of <strong>{formatPrice(selectedOrder.total)}</strong>. Coins & stock will be restored automatically.
                    </p>
                    <Button className="w-full gap-1 bg-violet-600 hover:bg-violet-700 text-white" disabled={!!actionPending}
                      onClick={() => doAction(selectedOrder.id, "return-initiate-refund", {}, "Refund initiated — customer notified")}>
                      <DollarSign className="w-4 h-4" />{actionPending ? "Processing…" : `Initiate Refund of ${formatPrice(selectedOrder.total)}`}
                    </Button>
                  </div>
                )}

                {isRefundDone && (
                  <div className="text-xs text-violet-600 bg-violet-50 rounded-lg px-3 py-2 text-center">
                    ✅ Refund has been initiated. This return is closed.
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Photo lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="Return photo" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
}
