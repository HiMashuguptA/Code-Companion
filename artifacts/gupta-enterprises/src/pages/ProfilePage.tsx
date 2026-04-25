import { useState, useEffect } from "react";
import { User, Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetProfile, useUpdateProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/FirebaseContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function ProfilePage() {
  const { currentUser, dbUser, signOut, isLoading: authLoading } = useAuth();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useGetProfile({
    query: { queryKey: getGetProfileQueryKey(), enabled: !!currentUser, retry: false }
  });
  const updateProfile = useUpdateProfile();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  const handleSave = () => {
    updateProfile.mutate({ data: { name: name || undefined, phone: phone || undefined } }, {
      onSuccess: () => {
        toast.success("Profile updated!");
        setEditing(false);
        qc.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      },
      onError: () => toast.error("Failed to update profile"),
    });
  };

  // Show skeleton while auth is loading
  if (authLoading || isLoading) return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <Skeleton className="h-8 w-32 mb-6" />
      <Skeleton className="h-32 w-full rounded-2xl mb-4" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );

  // Show sign in page only after auth loading completes and no user
  if (!currentUser) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <User className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
        <h2 className="text-xl font-semibold mb-2">Please sign in to view your profile</h2>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>

      {/* Avatar + role */}
      <div className="bg-card border rounded-2xl p-6 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold shrink-0 overflow-hidden">
            {profile?.photoUrl ? (
              <img src={profile.photoUrl} alt={profile.name ?? "User"} className="w-full h-full object-cover" />
            ) : (
              (profile?.name ?? currentUser.email ?? "U")[0]?.toUpperCase()
            )}
          </div>
          <div>
            <p className="font-semibold text-lg">{profile?.name ?? "No name set"}</p>
            <p className="text-sm text-muted-foreground">{profile?.email ?? currentUser.email}</p>
            <Badge variant="secondary" className="mt-1 text-xs capitalize">
              {(dbUser?.role ?? "USER").toLowerCase().replace("_", " ")}
            </Badge>
          </div>
        </div>
      </div>

      {/* Profile details */}
      <div className="bg-card border rounded-2xl p-6 mb-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold">Personal Information</h2>
          {!editing && <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit</Button>}
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Full Name</Label>
            {editing ? (
              <input className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
            ) : (
              <p className="mt-1 text-sm">{profile?.name ?? <span className="text-muted-foreground italic">Not set</span>}</p>
            )}
          </div>

          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email</Label>
            <p className="mt-1 text-sm">{profile?.email ?? currentUser.email}</p>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Phone</Label>
            {editing ? (
              <input className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 XXXXXXXXXX" type="tel" />
            ) : (
              <p className="mt-1 text-sm">{profile?.phone ?? <span className="text-muted-foreground italic">Not set</span>}</p>
            )}
          </div>

          {profile?.addresses && profile.addresses.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Saved Addresses</Label>
              <div className="mt-1 space-y-1">
                {profile.addresses.map((addr: { id: string; label?: string; street: string; city: string; state: string; pincode: string }) => (
                  <div key={addr.id} className="text-sm p-2 bg-muted rounded-lg">
                    {addr.label && <span className="font-medium text-xs text-muted-foreground uppercase">{addr.label} </span>}
                    {[addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ")}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {editing && (
          <div className="flex gap-2 mt-4">
            <Button onClick={handleSave} disabled={updateProfile.isPending} className="flex-1">
              {updateProfile.isPending ? "Saving..." : "Save Changes"}
            </Button>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        )}
      </div>

      <Separator className="my-4" />

      <Button variant="destructive" className="w-full" onClick={() => signOut()}>Sign Out</Button>
    </div>
  );
}
