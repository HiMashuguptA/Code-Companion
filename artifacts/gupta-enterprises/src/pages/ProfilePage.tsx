import { useState } from "react";
import { User, Mail, Phone, MapPin, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useUpdateProfile } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/FirebaseContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getGetProfileQueryKey } from "@workspace/api-client-react";

export function ProfilePage() {
  const { currentUser, dbUser, signOut } = useAuth();
  const queryClient = useQueryClient();
  const updateProfile = useUpdateProfile();

  const [name, setName] = useState(dbUser?.name ?? "");
  const [phone, setPhone] = useState(dbUser?.phone ?? "");
  const [editing, setEditing] = useState(false);

  if (!currentUser || !dbUser) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <User className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
        <p className="text-muted-foreground">Please sign in to view your profile</p>
      </div>
    );
  }

  const handleSave = () => {
    updateProfile.mutate(
      { data: { name: name || undefined, phone: phone || undefined } },
      {
        onSuccess: () => {
          toast.success("Profile updated");
          setEditing(false);
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        },
        onError: () => toast.error("Failed to update profile"),
      }
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-8">My Profile</h1>

      {/* Avatar & Role */}
      <div className="bg-card border rounded-xl p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative">
            {dbUser.photoUrl ? (
              <img src={dbUser.photoUrl} alt={dbUser.name ?? "User"} className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary">
                {(dbUser.name ?? currentUser.email ?? "U")[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-xl font-semibold">{dbUser.name ?? currentUser.email}</h2>
            <p className="text-sm text-muted-foreground">{currentUser.email}</p>
            <div className="mt-2">
              <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${
                dbUser.role === "ADMIN" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" :
                dbUser.role === "DELIVERY_AGENT" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
              }`}>
                {dbUser.role === "DELIVERY_AGENT" ? "Delivery Agent" : dbUser.role === "ADMIN" ? "Admin" : "Customer"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div className="bg-card border rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Personal Information</h3>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => { setName(dbUser.name ?? ""); setPhone(dbUser.phone ?? ""); setEditing(true); }}>
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={updateProfile.isPending}>Save</Button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
              <User className="w-3.5 h-3.5" /> Full Name
            </Label>
            {editing ? (
              <input
                className="w-full px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter your name"
              />
            ) : (
              <p className="text-sm py-2">{dbUser.name ?? <span className="text-muted-foreground">Not set</span>}</p>
            )}
          </div>

          <div>
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
              <Mail className="w-3.5 h-3.5" /> Email
            </Label>
            <p className="text-sm py-2">{currentUser.email ?? <span className="text-muted-foreground">Not available</span>}</p>
          </div>

          <div>
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
              <Phone className="w-3.5 h-3.5" /> Phone Number
            </Label>
            {editing ? (
              <input
                className="w-full px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            ) : (
              <p className="text-sm py-2">{dbUser.phone ?? <span className="text-muted-foreground">Not set</span>}</p>
            )}
          </div>
        </div>
      </div>

      {/* Sign Out */}
      <div className="bg-card border rounded-xl p-6">
        <h3 className="font-semibold mb-4">Account</h3>
        <Button variant="outline" onClick={() => signOut()} className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground">
          Sign Out
        </Button>
      </div>
    </div>
  );
}
