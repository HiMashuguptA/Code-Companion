import { useState } from "react";
import { CheckCircle, XCircle, Phone, Mail, Package, RotateCcw, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useListOrders, getListOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/FirebaseContext";
import { auth } from "@/contexts/FirebaseContext";
import { toast } from "sonner";
import { formatDateTime, formatPrice } from "@/lib/utils";

type ReturnOrder = {
  id: string;
  status: string;
  notes?: string | null;
  total: number;
  createdAt: string;
  items: Array<{ productName?: string; quantity: number; price: number }>;
  user?: { name?: string | null; email: string; phone?: string | null } | null;
  deliveryAddress?: { street?: string; city?: string; state?: string } | null;
};

function parseReturnData(order: ReturnOrder) {
  const notes = order.notes ?? "";
  const prefix = notes.startsWith("RETURN_REQUESTED:")
    ? "RETURN_REQUESTED"
    : notes.startsWith("RETURN_APPROVED:")
    ? "RETURN_APPROVED"
    : notes.startsWith("RETURN_REJECTED:")
    ? "RETURN_REJECTED"
    : null;
  const reason = prefix ? notes.slice(prefix.length + 1).split(" | images:")[0].trim() : "";
  const imageCount = notes.includes("| images:") ? parseInt(notes.split("| images:")[1] ?? "0") : 0;
  return { prefix, reason, imageCount };
}

export function AdminReturns() {
  const qc = useQueryClient();
  const { currentUser } = useAuth();
  const [selectedOrder, setSelectedOrder] = useState<ReturnOrder | null>(null);
  const [rejectMsg, setRejectMsg] = useState("");
  const [actionPending, setActionPending] = useState<string | null>(null);

  const { data, isLoading } = useListOrders({ limit: 200 }, {
    query: {
      queryKey: getListOrdersQueryKey({ limit: 200 }),
      enabled: !!currentUser,
      refetchInterval: 15000,
    },
  });

  const allOrders = (data?.orders ?? []) as ReturnOrder[];
  const returnOrders = allOrders.filter(o => {
    const notes = o.notes ?? "";
    return notes.startsWith("RETURN_REQUESTED:") || notes.startsWith("RETURN_APPROVED:") || notes.startsWith("RETURN_REJECTED:");
  });

  const handleAction = async (orderId: string, action: "approve" | "reject") => {
    if (action === "reject" && !rejectMsg.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    setActionPending(orderId + action);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/orders/${orderId}/return-${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ message: action === "reject" ? rejectMsg : undefined }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed");
      }
      toast.success(action === "approve" ? "Return approved and customer notified" : "Return rejected and customer notified");
      setSelectedOrder(null);
      setRejectMsg("");
      qc.invalidateQueries({ queryKey: getListOrdersQueryKey({ limit: 200 }) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setActionPending(null);
    }
  };

  const statusBadge = (prefix: string | null) => {
    if (prefix === "RETURN_REQUESTED") return <Badge className="bg-orange-500/10 text-orange-700 border-orange-500/30 hover:bg-orange-500/10">Pending Review</Badge>;
    if (prefix === "RETURN_APPROVED") return <Badge className="bg-green-500/10 text-green-700 border-green-500/30 hover:bg-green-500/10">Approved</Badge>;
    if (prefix === "RETURN_REJECTED") return <Badge className="bg-red-500/10 text-red-700 border-red-500/30 hover:bg-red-500/10">Rejected</Badge>;
    return null;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><RotateCcw className="w-6 h-6" /> Return Requests</h1>
          <p className="text-sm text-muted-foreground">Manage customer return requests. Review, approve, or reject with a message.</p>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1">
          {returnOrders.filter(o => (o.notes ?? "").startsWith("RETURN_REQUESTED:")).length} pending
        </Badge>
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
            const { prefix, reason, imageCount } = parseReturnData(order);
            const isPending = (order.notes ?? "").startsWith("RETURN_REQUESTED:");
            return (
              <div key={order.id} className={`bg-card border rounded-xl p-4 ${isPending ? "border-orange-300 dark:border-orange-900" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-semibold text-sm">Order #{order.id.slice(-8).toUpperCase()}</span>
                      {statusBadge(prefix)}
                      <span className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</span>
                    </div>

                    {order.user && (
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-2">
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <Package className="w-3 h-3" /> {order.user.name ?? "—"}
                        </span>
                        <a href={`mailto:${order.user.email}`} className="flex items-center gap-1 hover:text-primary">
                          <Mail className="w-3 h-3" /> {order.user.email}
                        </a>
                        {order.user.phone && (
                          <a href={`tel:${order.user.phone}`} className="flex items-center gap-1 hover:text-primary">
                            <Phone className="w-3 h-3" /> {order.user.phone}
                          </a>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                      <MessageSquare className="w-3 h-3" />
                      <span className="italic">"{reason}"</span>
                      {imageCount > 0 && <span className="ml-1 text-blue-600">({imageCount} photo{imageCount > 1 ? "s" : ""})</span>}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {order.items?.slice(0, 2).map((item, i) => (
                        <span key={i}>{item.productName ?? "Product"} ×{item.quantity}{i < Math.min(order.items.length, 2) - 1 ? ", " : ""}</span>
                      ))}
                      {order.items?.length > 2 && <span> +{order.items.length - 2} more</span>}
                      <span className="ml-2 font-medium text-foreground">{formatPrice(order.total)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => { setSelectedOrder(order); setRejectMsg(""); }}>
                      View Details
                    </Button>
                    {isPending && (
                      <>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1"
                          disabled={!!actionPending}
                          onClick={() => handleAction(order.id, "approve")}>
                          <CheckCircle className="w-3.5 h-3.5" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" className="gap-1"
                          disabled={!!actionPending}
                          onClick={() => setSelectedOrder({ ...order, _action: "reject" } as ReturnOrder & { _action: string })}>
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedOrder} onOpenChange={open => { if (!open) { setSelectedOrder(null); setRejectMsg(""); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Return Request — Order #{selectedOrder?.id.slice(-8).toUpperCase()}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (() => {
            const { prefix, reason, imageCount } = parseReturnData(selectedOrder);
            const isRejectFlow = (selectedOrder as ReturnOrder & { _action?: string })._action === "reject";
            const isPending = (selectedOrder.notes ?? "").startsWith("RETURN_REQUESTED:");
            return (
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-2">{statusBadge(prefix)}</div>

                {selectedOrder.user && (
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                    <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-1">Customer Details</p>
                    <p className="font-medium">{selectedOrder.user.name ?? "—"}</p>
                    <a href={`mailto:${selectedOrder.user.email}`} className="flex items-center gap-1.5 text-blue-600 hover:underline">
                      <Mail className="w-3.5 h-3.5" /> {selectedOrder.user.email}
                    </a>
                    {selectedOrder.user.phone && (
                      <a href={`tel:${selectedOrder.user.phone}`} className="flex items-center gap-1.5 text-blue-600 hover:underline">
                        <Phone className="w-3.5 h-3.5" /> {selectedOrder.user.phone}
                      </a>
                    )}
                    {selectedOrder.deliveryAddress && (
                      <p className="text-muted-foreground text-xs mt-1">
                        {[selectedOrder.deliveryAddress.street, selectedOrder.deliveryAddress.city, selectedOrder.deliveryAddress.state].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                )}

                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-1">Return Reason</p>
                  <p className="italic">"{reason}"</p>
                  {imageCount > 0 && <p className="text-blue-600 text-xs mt-1">{imageCount} photo{imageCount > 1 ? "s" : ""} attached by customer</p>}
                </div>

                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">Items Ordered</p>
                  <div className="space-y-1">
                    {selectedOrder.items?.map((item, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{item.productName ?? "Product"} ×{item.quantity}</span>
                        <span className="text-muted-foreground">{formatPrice(item.price * item.quantity)}</span>
                      </div>
                    ))}
                    <div className="border-t pt-1 mt-1 flex justify-between font-semibold">
                      <span>Order Total</span>
                      <span>{formatPrice(selectedOrder.total)}</span>
                    </div>
                  </div>
                </div>

                {isPending && (
                  <div className="space-y-3">
                    {isRejectFlow ? (
                      <>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Rejection Reason (sent to customer)</label>
                          <textarea
                            className="w-full px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                            rows={3}
                            placeholder="Explain why the return is being rejected..."
                            value={rejectMsg}
                            onChange={e => setRejectMsg(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button variant="destructive" className="flex-1 gap-1" disabled={!!actionPending}
                            onClick={() => handleAction(selectedOrder.id, "reject")}>
                            <XCircle className="w-4 h-4" />
                            {actionPending ? "Rejecting..." : "Confirm Rejection"}
                          </Button>
                          <Button variant="outline" onClick={() => setSelectedOrder(null)}>Cancel</Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-1" disabled={!!actionPending}
                          onClick={() => handleAction(selectedOrder.id, "approve")}>
                          <CheckCircle className="w-4 h-4" />
                          {actionPending ? "Approving..." : "Approve Return"}
                        </Button>
                        <Button variant="destructive" className="gap-1" disabled={!!actionPending}
                          onClick={() => setSelectedOrder({ ...selectedOrder, _action: "reject" } as ReturnOrder & { _action: string })}>
                          <XCircle className="w-4 h-4" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
