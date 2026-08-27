import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useClubLogos, type ClubLogo } from "@/hooks/useClubLogos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Trash2, Edit2, Loader2, Shield, X } from "lucide-react";

const SPORTS: { key: string; label: string }[] = [
  { key: "football", label: "Fotbal" },
  { key: "basketball", label: "Baschet" },
];

export default function AdminClubLogos({ embedded }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logos, loading, saveLogo, updateLogo, removeLogo } = useClubLogos();
  const [sport, setSport] = useState<string>("football");
  const [newClubName, setNewClubName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingClub, setEditingClub] = useState<ClubLogo | null>(null);

  const startEdit = (club: ClubLogo) => {
    setEditingClub(club);
    setNewClubName(club.club_name);
  };

  const cancelEdit = () => {
    setEditingClub(null);
    setNewClubName("");
  };

  const handleFileUpload = async (file: File) => {
    const clubName = newClubName.trim();
    if (!clubName) {
      toast({ title: "Introdu mai întâi numele clubului", variant: "destructive" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const safeName = clubName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const path = `${sport}/${safeName}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("club-logos").upload(path, file, { upsert: true });
    if (uploadError) {
      toast({ title: "Eroare", description: "Nu s-a putut încărca logo-ul.", variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("club-logos").getPublicUrl(path);
    const { error } = editingClub
      ? await updateLogo(editingClub.id, { club_name: clubName, logo_url: urlData.publicUrl }, user.id)
      : await saveLogo(clubName, urlData.publicUrl, user.id, sport);
    setUploading(false);
    if (error) {
      toast({ title: "Eroare la salvare", variant: "destructive" });
    } else {
      toast({ title: editingClub ? "Club actualizat!" : "Logo salvat!" });
      setNewClubName("");
      setEditingClub(null);
    }
  };

  const handleSaveNameOnly = async () => {
    if (!editingClub) return;
    const clubName = newClubName.trim();
    if (!clubName) {
      toast({ title: "Numele clubului nu poate fi gol", variant: "destructive" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(true);
    const { error } = await updateLogo(editingClub.id, { club_name: clubName }, user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Eroare la salvare", variant: "destructive" });
    } else {
      toast({ title: "Club actualizat!" });
      setNewClubName("");
      setEditingClub(null);
    }
  };

  const handleRemove = async (clubName: string, logoSport: string) => {
    const { error } = await removeLogo(clubName, logoSport);
    if (error) {
      toast({ title: "Eroare la ștergere", variant: "destructive" });
    } else {
      toast({ title: "Logo șters." });
    }
  };

  const filteredLogos = logos.filter((l) => l.sport === sport);

  return (
    <div className={embedded ? "text-gray-900" : "min-h-screen bg-gray-200 text-gray-900"}>
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        {!embedded && (
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-heading font-bold">Logo-uri Cluburi</h1>
          </div>
        )}
        {embedded && (
          <h1 className="text-2xl font-heading font-bold mb-2 flex items-center gap-2">
            <Shield className="h-6 w-6" /> Logo-uri Cluburi
          </h1>
        )}
        <p className="text-sm text-gray-500 mb-6">
          Logo-ul unui club apare pe profilul jucătorilor doar dacă sportul și numele clubului scris în profil (câmpul „Echipă curentă") se potrivesc
          cu sportul și numele introduse aici (indiferent de majuscule sau diacritice). Dacă echipa unui jucător nu se regăsește în listă, nu apare niciun logo.
        </p>

        {/* Sport selector */}
        <div className="flex gap-2 mb-6">
          {SPORTS.map((s) => (
            <Button
              key={s.key}
              variant={sport === s.key ? "default" : "outline"}
              size="sm"
              onClick={() => setSport(s.key)}
            >
              {s.label}
            </Button>
          ))}
        </div>

        {/* Add new / Edit existing */}
        <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-3 mb-6">
          {editingClub && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-orange-500 uppercase tracking-wider">Editează club</span>
              <button type="button" onClick={cancelEdit} className="text-gray-500 hover:text-gray-900 transition-colors" title="Anulează">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <Input
            placeholder="Numele clubului (ex: Real Madrid)"
            value={newClubName}
            onChange={(e) => setNewClubName(e.target.value)}
          />
          {editingClub && (
            <div className="flex items-center gap-3">
              <img src={editingClub.logo_url} alt={editingClub.club_name} className="h-10 w-10 object-contain bg-white border border-gray-200 rounded-lg p-1" />
              <Button type="button" size="sm" onClick={handleSaveNameOnly} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white">
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Salvează numele
              </Button>
            </div>
          )}
          <div
            className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-orange-300 transition-colors"
            onClick={() => document.getElementById("admin-club-logo-upload")?.click()}
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 text-gray-500 mx-auto animate-spin" />
            ) : (
              <Upload className="h-5 w-5 text-gray-500 mx-auto" />
            )}
            <span className="text-xs text-gray-500 font-body block mt-1">
              {editingClub ? "Încarcă o imagine nouă pentru acest logo" : "Încarcă imaginea logo-ului (PNG, JPG, SVG, WebP)"}
            </span>
          </div>
          <input
            id="admin-club-logo-upload"
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
              e.target.value = "";
            }}
          />
        </div>

        {/* Existing list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          </div>
        ) : filteredLogos.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">Niciun logo adăugat încă pentru {SPORTS.find((s) => s.key === sport)?.label.toLowerCase()}.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredLogos.map((l) => (
              <div key={l.id} className="relative border border-gray-200 rounded-lg p-3 bg-white flex flex-col items-center gap-2">
                <div className="absolute top-1 right-1 flex gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-6 w-6"
                    onClick={() => startEdit(l)}
                    title="Editează"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="h-6 w-6"
                    onClick={() => handleRemove(l.club_name, l.sport)}
                    title="Șterge logo"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="h-12 w-12 flex items-center justify-center bg-white rounded-md">
                  <img src={l.logo_url} alt={l.club_name} className="h-full w-full object-contain" />
                </div>
                <span className="text-xs text-center font-body truncate w-full">{l.club_name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
